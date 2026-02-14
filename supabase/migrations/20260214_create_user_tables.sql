-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create user_profiles table (擴充用戶資料)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username varchar(30),
  avatar_url text,
  locale varchar(10) default 'zh-HK',
  region varchar(10) default 'HK',          -- 'HK' / 'TW' / 'JP' 等
  favorite_language varchar(5) default 'jp',-- 卡牌語言偏好: 'jp','en','zh'
  is_premium boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index on region for faster queries
create index if not exists idx_user_profiles_region on public.user_profiles (region);

-- Create user_identities table (儲存 OAuth Provider 資訊)
create table if not exists public.user_identities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete cascade,
  provider varchar(20) not null,             -- 'google','facebook','apple','email'
  provider_user_id varchar(191) not null,    -- Google sub / Facebook id / Apple sub
  email varchar(191),
  created_at timestamptz default now()
);

-- Create unique index to prevent duplicate identities
create unique index if not exists idx_user_identity_unique
on public.user_identities (provider, provider_user_id);

-- Enable Row Level Security (RLS)
alter table public.user_profiles enable row level security;
alter table public.user_identities enable row level security;

-- Create policies for user_profiles
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- Create policies for user_identities
create policy "Users can view their own identities"
  on public.user_identities for select
  using (auth.uid() = user_id);

create policy "Users can insert their own identities"
  on public.user_identities for insert
  with check (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger to update updated_at on user_profiles
create trigger set_updated_at
  before update on public.user_profiles
  for each row
  execute function public.handle_updated_at();
