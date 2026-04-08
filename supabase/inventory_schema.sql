-- CleanSlate Inventory Management + Quote Logging
-- Run this in the Supabase SQL Editor AFTER the initial schema

-- ============================================
-- SKU SEQUENCE TABLE (for atomic SKU generation)
-- ============================================
create table if not exists sku_sequences (
  prefix text primary key,
  last_number integer not null default 0
);

-- Atomic SKU generator function
create or replace function next_sku(p_prefix text)
returns text as $$
declare
  v_num integer;
begin
  insert into sku_sequences (prefix, last_number)
  values (p_prefix, 1)
  on conflict (prefix)
  do update set last_number = sku_sequences.last_number + 1
  returning last_number into v_num;

  return 'CS-' || p_prefix || '-' || lpad(v_num::text, 4, '0');
end;
$$ language plpgsql;

-- ============================================
-- INVENTORY TABLE (one row per physical item)
-- ============================================
create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  sku text not null unique,
  order_item_id uuid references order_items(id),
  order_id uuid references orders(id),
  asin text,
  title text not null,
  category text check (category in ('book', 'dvd', 'cd', 'game')),
  condition_received text,
  condition_graded text,
  cost_cents integer not null default 0,
  sell_price_cents integer,
  expected_profit_cents integer,
  fba_fee_cents integer,
  referral_fee_cents integer,
  closing_fee_cents integer default 180,
  prep_fee_cents integer default 145,
  inbound_ship_cents integer,
  status text not null default 'received' check (status in ('received', 'grading', 'graded', 'listed', 'shipped_to_fba', 'active', 'sold', 'removed')),
  received_at timestamptz not null default now(),
  graded_at timestamptz,
  listed_at timestamptz,
  sold_at timestamptz,
  amazon_listing_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_sku on inventory(sku);
create index if not exists idx_inventory_status on inventory(status);
create index if not exists idx_inventory_order_item on inventory(order_item_id);
create index if not exists idx_inventory_order on inventory(order_id);
create index if not exists idx_inventory_asin on inventory(asin);
create index if not exists idx_inventory_category on inventory(category);
create index if not exists idx_inventory_received on inventory(received_at);

-- ============================================
-- QUOTE LOG TABLE (every quote given)
-- ============================================
create table if not exists quote_log (
  id uuid primary key default uuid_generate_v4(),
  barcode text,
  asin text,
  title text,
  category text,
  condition text,
  has_case boolean default true,
  sell_price_cents integer,
  offer_cents integer default 0,
  status text not null default 'quoted' check (status in ('quoted', 'accepted', 'ordered', 'expired')),
  quote_color text,
  pricing_mode text default 'buyback',
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_log_barcode on quote_log(barcode);
create index if not exists idx_quote_log_asin on quote_log(asin);
create index if not exists idx_quote_log_status on quote_log(status);
create index if not exists idx_quote_log_created on quote_log(created_at);

-- ============================================
-- RLS + Triggers
-- ============================================
alter table inventory enable row level security;
alter table quote_log enable row level security;
alter table sku_sequences enable row level security;

create policy "Service role full access" on inventory for all using (true) with check (true);
create policy "Service role full access" on quote_log for all using (true) with check (true);
create policy "Service role full access" on sku_sequences for all using (true) with check (true);

create trigger inventory_updated_at before update on inventory for each row execute function update_updated_at();
