-- Per-unit price (HKD) when a copy was first added to the user's collection.

alter table public.user_collection
  add column if not exists entry_price numeric(14, 2) null;

comment on column public.user_collection.entry_price is
  'Per-unit price in HKD when this collection copy was first added to user_collection.';

-- Backfill from linked purchase records (price per unit at buy time).
update public.user_collection uc
set entry_price = be.price_hkd
from public.buy_entries be
where uc.buying_entries_id = be.id
  and uc.entry_price is null;
