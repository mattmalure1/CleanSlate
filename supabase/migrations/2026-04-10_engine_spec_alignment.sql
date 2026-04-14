-- ============================================================
-- CleanSlate — Engine Spec Alignment Migration
-- Date: 2026-04-10
-- Purpose: Align database with CLEANSLATE_DB_AND_ENGINE.md spec
--
-- Adds:
--   - quote_items (spec §1.2)
--   - tier_thresholds (spec §1.8) + seed data (spec §2.4)
--   - offer_engine_config (spec §1.9) + seed data
--   - do_not_buy (spec §1.7)
--
-- NOTE: The spec-compliant `quotes` table (§1.1) does NOT exist in the
-- production Supabase yet — only the legacy `quote_log` table does.
-- quote_items.quote_id is kept as a nullable UUID with NO foreign key
-- for now. When the spec §1.1 quotes table is built in a later sprint,
-- a follow-up migration can add the FK constraint.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- Safety: ensure uuid_generate_v4() is available
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- quote_items (spec §1.2)
-- Every individual item in every quote, including rejected ones.
-- calculation_trace JSONB is the full audit trail of the 11-step
-- algorithm — retained indefinitely per spec §3.4.
-- ------------------------------------------------------------
create table if not exists quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid, -- no FK yet — spec §1.1 quotes table doesn't exist in production
  created_at timestamptz default now(),
  upc text not null,
  asin text,
  category text,
  title text,
  offer_cents integer,
  accepted boolean not null,
  rejection_reason text,
  rejection_step integer, -- 1..11, which step fired the rejection (null if accepted)
  tier text,
  keepa_data_timestamp timestamptz not null,
  calculation_trace jsonb not null
);

create index if not exists idx_quote_items_quote on quote_items(quote_id);
create index if not exists idx_quote_items_asin on quote_items(asin);
create index if not exists idx_quote_items_accepted on quote_items(accepted);
create index if not exists idx_quote_items_rejection_step on quote_items(rejection_step);
create index if not exists idx_quote_items_created on quote_items(created_at desc);

alter table quote_items enable row level security;
create policy "Service role full access" on quote_items for all using (true) with check (true);

-- ------------------------------------------------------------
-- tier_thresholds (spec §1.8)
-- Primary tier assignment is by sales_rank_drops_90.
-- bsr_ceiling is the secondary gate.
-- ------------------------------------------------------------
create table if not exists tier_thresholds (
  category text not null,
  tier text not null,
  min_rank_drops_90 integer not null,
  max_rank_drops_90 integer,
  bsr_ceiling integer not null,
  roi_floor_percent integer not null,
  min_flat_margin_cents integer not null,
  updated_at timestamptz default now(),
  updated_by text,
  primary key (category, tier)
);

alter table tier_thresholds enable row level security;
create policy "Service role full access" on tier_thresholds for all using (true) with check (true);

-- Seed per V2 spec — ROI floors lowered to 40/60/85/125 to accept more inventory
-- while still protecting margin. Penny tier ($0.10 at $0.50+ net profit) handles
-- items that still fail these floors.
insert into tier_thresholds (category, tier, min_rank_drops_90, bsr_ceiling, roi_floor_percent, min_flat_margin_cents) values
  -- books
  ('book',   'T1', 30,  500000,  40, 150),
  ('book',   'T2', 15, 1500000,  60, 250),
  ('book',   'T3',  8, 2500000,  85, 400),
  ('book',   'T4',  4, 3000000, 125, 600),
  -- dvds
  ('dvd',    'T1', 30,   50000,  40, 150),
  ('dvd',    'T2', 15,   80000,  60, 250),
  ('dvd',    'T3',  8,  120000,  85, 400),
  ('dvd',    'T4',  4,  150000, 125, 600),
  -- blu-rays
  ('bluray', 'T1', 30,   50000,  40, 150),
  ('bluray', 'T2', 15,   80000,  60, 250),
  ('bluray', 'T3',  8,  120000,  85, 400),
  ('bluray', 'T4',  4,  150000, 125, 600),
  -- cds (no T4 — CD market is declining)
  ('cd',     'T1', 30,  100000,  40, 300),
  ('cd',     'T2', 15,  150000,  60, 400),
  ('cd',     'T3',  8,  200000,  85, 600),
  -- games (no T4 — higher capital exposure)
  ('game',   'T1', 30,   50000,  40, 250),
  ('game',   'T2', 15,   80000,  60, 400),
  ('game',   'T3',  8,  120000,  85, 600)
on conflict (category, tier) do nothing;

-- ------------------------------------------------------------
-- offer_engine_config (spec §1.9)
-- Key/value tunable parameters. Engine loads at startup.
-- ------------------------------------------------------------
create table if not exists offer_engine_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now(),
  updated_by text
);

alter table offer_engine_config enable row level security;
create policy "Service role full access" on offer_engine_config for all using (true) with check (true);

-- Seed per spec §1.9
insert into offer_engine_config (key, value, description) values
  ('closing_fee_cents',                to_jsonb(180),    'Amazon closing fee per media item, cents'),
  ('prep_cost_cents',                  to_jsonb(0),      'Our per-item prep labor/materials, cents — Matt preps in-house, no cost'),
  ('rejection_return_overhead_cents',  to_jsonb(30),     'Amortized per-item cost of the return-on-reject policy'),
  ('inbound_per_lb_cents',             to_jsonb(50),     'Inbound shipping to FBA, cents per pound (empirical from legacy engine, not spec guess of 45)'),
  ('disc_buffer_cents',                to_jsonb(50),     'Extra buffer for disc items (dvd/bluray/cd/game)'),
  ('storage_reserve_cents',            to_jsonb(15),     'Monthly storage reserve per unit'),
  ('media_mail_receive_cents',         to_jsonb(50),     'Amortized media mail receive cost'),
  ('min_cart_value_cents',             to_jsonb(1000),   'Minimum cart value to checkout'),
  ('min_cart_items',                   to_jsonb(10),     'Minimum item count to checkout'),
  ('quote_expiration_days',            to_jsonb(7),      'Days until a quote expires'),
  ('max_copies_per_asin',              to_jsonb(10),     'Hard cap on copies per ASIN in flight'),
  ('daily_payout_cap_cents',           to_jsonb(200000), '$2000 daily payout cap'),
  ('referral_fee_rate',                to_jsonb(0.15),   'Amazon referral fee rate (15% for media)')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- do_not_buy (spec §1.7)
-- ASINs on cooldown — auto-rejected at Step 3 of the engine
-- until expires_at passes.
-- ------------------------------------------------------------
create table if not exists do_not_buy (
  asin text primary key,
  reason text not null,
  added_at timestamptz default now(),
  expires_at timestamptz not null
);

create index if not exists idx_do_not_buy_expires on do_not_buy(expires_at);

alter table do_not_buy enable row level security;
create policy "Service role full access" on do_not_buy for all using (true) with check (true);
