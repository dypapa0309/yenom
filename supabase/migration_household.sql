-- =============================================
-- Household 기능 추가 마이그레이션
-- =============================================

-- 새 테이블
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

create table if not exists household_visibility (
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  visible boolean not null default true,
  primary key (household_id, user_id, category)
);

-- RLS 활성화
alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table household_visibility enable row level security;

-- Policy 추가 (이미 있으면 skip)
do $$ begin

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
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "households_member" on households for select
  using (
    created_by = auth.uid() or
    exists (select 1 from household_members where household_id = id and user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "households_owner_write" on households for all using (created_by = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_members_read" on household_members for select
  using (
    user_id = auth.uid() or
    exists (select 1 from household_members hm where hm.household_id = household_members.household_id and hm.user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_members_own" on household_members for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_members_delete" on household_members for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_invites_read" on household_invites for select
  using (
    invited_by = auth.uid() or
    exists (select 1 from household_members where household_id = household_invites.household_id and user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_invites_write" on household_invites for all using (invited_by = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_invites_accept" on household_invites for update using (status = 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_visibility_own" on household_visibility for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_visibility_read" on household_visibility for select
  using (
    exists (select 1 from household_members where household_id = household_visibility.household_id and user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

-- 인덱스
create index if not exists idx_household_members_user on household_members(user_id);
create index if not exists idx_household_members_household on household_members(household_id);
create index if not exists idx_household_visibility on household_visibility(household_id, user_id);
