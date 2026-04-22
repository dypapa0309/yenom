-- =============================================
-- Yenom DB Schema
-- =============================================

create extension if not exists "uuid-ossp";

-- Uploads
create table if not exists uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  filename text not null,
  uploaded_at timestamptz default now() not null,
  source_type text not null default 'xlsx'
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  upload_id uuid references uploads(id) on delete cascade not null,
  transaction_date date not null,
  description text not null,
  amount numeric(15,2) not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  merchant_name text,
  category text not null default '기타',
  excluded boolean default false not null,
  memo text,
  created_at timestamptz default now() not null
);

-- Budgets
create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month text not null,
  category text not null,
  budget_amount numeric(15,2) not null,
  created_at timestamptz default now() not null,
  unique(user_id, month, category)
);

-- User classification rules
create table if not exists user_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  keyword text,
  merchant_name text,
  category text not null,
  created_at timestamptz default now() not null
);

-- =============================================
-- Row Level Security
-- =============================================

alter table uploads enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table user_rules enable row level security;

create policy "uploads_owner" on uploads for all using (auth.uid() = user_id);
create policy "transactions_owner" on transactions for all using (auth.uid() = user_id);
create policy "budgets_owner" on budgets for all using (auth.uid() = user_id);
create policy "user_rules_owner" on user_rules for all using (auth.uid() = user_id);

-- =============================================
-- Indexes
-- =============================================

create index if not exists idx_transactions_user_date on transactions(user_id, transaction_date desc);
create index if not exists idx_transactions_category on transactions(user_id, category);
create index if not exists idx_transactions_type on transactions(user_id, type);
create index if not exists idx_uploads_user on uploads(user_id);
create index if not exists idx_budgets_user_month on budgets(user_id, month);
create index if not exists idx_user_rules_user on user_rules(user_id);
