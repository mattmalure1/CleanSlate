-- ============================================================
-- CleanSlate — Gated Items Migration
-- Date: 2026-04-13
-- Purpose: Move gated brands/ASINs from hardcoded JS to a DB
-- table Matt can manage via admin UI without code deploys.
-- ============================================================

create table if not exists gated_items (
  id uuid primary key default uuid_generate_v4(),
  pattern text not null,
  match_type text not null check (match_type in ('brand', 'asin')),
  reason text not null default 'Brand gated on Amazon',
  added_at timestamptz default now(),
  added_by text,
  active boolean not null default true
);

create index if not exists idx_gated_items_active on gated_items(active) where active = true;
create index if not exists idx_gated_items_type on gated_items(match_type);

alter table gated_items enable row level security;
create policy "Service role full access" on gated_items for all using (true) with check (true);

-- Seed with the 3 existing hardcoded patterns
insert into gated_items (pattern, match_type, reason, added_by) values
  ('disney',               'brand', 'Disney brand gating — cannot list on Amazon FBA', 'migration'),
  ('studio ghibli',        'brand', 'Studio Ghibli brand gating', 'migration'),
  ('criterion collection', 'brand', 'Criterion Collection brand gating', 'migration')
on conflict do nothing;
