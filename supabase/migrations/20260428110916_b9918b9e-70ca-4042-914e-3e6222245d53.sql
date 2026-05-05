create table if not exists public.gold_prices (
  id uuid primary key default gen_random_uuid(),
  karat text not null unique,
  sell numeric,
  buy numeric,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gold_prices enable row level security;

create policy "Anyone can read gold prices"
on public.gold_prices for select
using (true);

create trigger gold_prices_set_updated_at
before update on public.gold_prices
for each row execute function public.update_updated_at_column();