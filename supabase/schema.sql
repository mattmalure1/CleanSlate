-- CleanSlate Media Buyback — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- CUSTOMERS
-- ============================================
create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  payout_method text not null check (payout_method in ('paypal', 'venmo', 'check')),
  payout_details text not null,
  address jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_email on customers(email);

-- ============================================
-- QUOTES (cached Keepa lookups + calculated offers)
-- ============================================
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  barcode text not null,
  asin text,
  title text,
  category text check (category in ('book', 'dvd', 'cd', 'game')),
  image_url text,
  keepa_data jsonb not null default '{}',
  sell_price_cents integer,
  offered_price_cents integer not null default 0,
  has_case boolean not null default true,
  status text not null default 'quoted' check (status in ('quoted', 'accepted', 'rejected', 'expired')),
  rejection_reason text,
  color text check (color in ('green', 'yellow', 'red')),
  cached_until timestamptz,
  created_at timestamptz not null default now()
);

create index idx_quotes_barcode on quotes(barcode);
create index idx_quotes_asin on quotes(asin);
create index idx_quotes_cached_until on quotes(cached_until);

-- ============================================
-- ORDERS
-- ============================================
create table orders (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id),
  status text not null default 'pending' check (status in ('pending', 'label_created', 'shipped', 'received', 'grading', 'graded', 'paid', 'cancelled')),
  total_offer_cents integer not null default 0,
  total_payout_cents integer,
  tracking_number text,
  label_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_customer on orders(customer_id);
create index idx_orders_status on orders(status);

-- ============================================
-- ORDER ITEMS
-- ============================================
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  quote_id uuid references quotes(id),
  asin text,
  title text not null,
  category text check (category in ('book', 'dvd', 'cd', 'game')),
  offered_price_cents integer not null,
  has_case boolean not null default true,
  graded_condition text check (graded_condition in ('like_new', 'very_good', 'good', 'acceptable', 'unsellable')),
  final_price_cents integer,
  created_at timestamptz not null default now()
);

create index idx_order_items_order on order_items(order_id);

-- ============================================
-- SHIPMENTS
-- ============================================
create table shipments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id),
  carrier text not null default 'USPS',
  service text not null default 'Media Mail',
  tracking_number text,
  label_url text,
  status text not null default 'created' check (status in ('created', 'in_transit', 'delivered', 'returned')),
  status_updates jsonb not null default '[]',
  shippo_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shipments_order on shipments(order_id);
create index idx_shipments_tracking on shipments(tracking_number);

-- ============================================
-- PAYOUTS
-- ============================================
create table payouts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id),
  customer_id uuid not null references customers(id),
  amount_cents integer not null,
  method text not null check (method in ('paypal', 'venmo', 'check')),
  transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payouts_order on payouts(order_id);
create index idx_payouts_status on payouts(status);

-- ============================================
-- Row Level Security (RLS) — basic policies
-- ============================================
-- For MVP, we'll use the service key on the backend
-- These policies are for future customer-facing access

alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table quotes enable row level security;
alter table shipments enable row level security;
alter table payouts enable row level security;

-- Allow service role full access (backend uses service key)
create policy "Service role full access" on customers for all using (true) with check (true);
create policy "Service role full access" on orders for all using (true) with check (true);
create policy "Service role full access" on order_items for all using (true) with check (true);
create policy "Service role full access" on quotes for all using (true) with check (true);
create policy "Service role full access" on shipments for all using (true) with check (true);
create policy "Service role full access" on payouts for all using (true) with check (true);

-- ============================================
-- Updated_at trigger function
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated_at before update on customers for each row execute function update_updated_at();
create trigger orders_updated_at before update on orders for each row execute function update_updated_at();
create trigger shipments_updated_at before update on shipments for each row execute function update_updated_at();
create trigger payouts_updated_at before update on payouts for each row execute function update_updated_at();
