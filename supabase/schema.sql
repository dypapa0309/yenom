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
-- Household (공유 가계부)
-- =============================================

create table if not exists households (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '우리 가계부',
  created_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

create table if not exists household_members (
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member',
  joined_at timestamptz default now() not null,
  primary key (household_id, user_id)
);

create table if not exists household_invites (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade not null,
  invited_by uuid references auth.users(id) on delete cascade not null,
  token uuid unique not null default uuid_generate_v4(),
  status text not null default 'pending',
  created_at timestamptz default now() not null
);

-- 멤버별 카테고리 공유 여부 (내 카테고리 중 어느 것을 파트너에게 보여줄지)
create table if not exists household_visibility (
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  visible boolean not null default true,
  primary key (household_id, user_id, category)
);

-- =============================================
-- Row Level Security
-- =============================================

alter table uploads enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table user_rules enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table household_visibility enable row level security;

-- 기존 데이터: 본인 소유
create policy "uploads_owner" on uploads for all using (auth.uid() = user_id);
create policy "budgets_owner" on budgets for all using (auth.uid() = user_id);
create policy "user_rules_owner" on user_rules for all using (auth.uid() = user_id);

-- 트랜잭션: 본인 데이터 전체 + 같은 household 멤버 데이터 읽기
create policy "transactions_own" on transactions for all using (auth.uid() = user_id);
create policy "transactions_household_read" on transactions for select
using (
  exists (
    select 1 from household_members hm1
    join household_members hm2 on hm1.household_id = hm2.household_id
    where hm1.user_id = auth.uid()
    and hm2.user_id = transactions.user_id
    and hm2.user_id != hm1.user_id
  )
);

-- Household 테이블
create policy "households_member" on households for select
using (
  created_by = auth.uid() or
  exists (select 1 from household_members where household_id = id and user_id = auth.uid())
);
create policy "households_owner_write" on households for all using (created_by = auth.uid());

create policy "household_members_read" on household_members for select
using (
  user_id = auth.uid() or
  exists (select 1 from household_members hm where hm.household_id = household_members.household_id and hm.user_id = auth.uid())
);
create policy "household_members_own" on household_members for insert with check (user_id = auth.uid());
create policy "household_members_delete" on household_members for delete using (user_id = auth.uid());

create policy "household_invites_read" on household_invites for select
using (
  invited_by = auth.uid() or
  exists (select 1 from household_members where household_id = household_invites.household_id and user_id = auth.uid())
);
create policy "household_invites_write" on household_invites for all using (invited_by = auth.uid());
create policy "household_invites_accept" on household_invites for update using (status = 'pending');

create policy "household_visibility_own" on household_visibility for all using (user_id = auth.uid());
create policy "household_visibility_read" on household_visibility for select
using (
  exists (select 1 from household_members where household_id = household_visibility.household_id and user_id = auth.uid())
);

-- =============================================
-- Indexes
-- =============================================

create index if not exists idx_transactions_user_date on transactions(user_id, transaction_date desc);
create index if not exists idx_transactions_category on transactions(user_id, category);
create index if not exists idx_transactions_type on transactions(user_id, type);
create index if not exists idx_uploads_user on uploads(user_id);
create index if not exists idx_budgets_user_month on budgets(user_id, month);
create index if not exists idx_user_rules_user on user_rules(user_id);
create index if not exists idx_household_members_user on household_members(user_id);
create index if not exists idx_household_members_household on household_members(household_id);
create index if not exists idx_household_visibility on household_visibility(household_id, user_id);
