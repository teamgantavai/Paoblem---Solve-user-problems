-- Create Profiles Table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text default 'Innovator',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Allow public read on profiles" on public.profiles for select using (true);
create policy "Allow update on profiles for owner" on public.profiles for update using (auth.uid() = id);

-- Trigger to sync new auth.users to profiles automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(
      new.raw_user_meta_data->>'avatar_url', 
      'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id::text
    ),
    coalesce(new.raw_user_meta_data->>'role', 'Innovator')
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      avatar_url = excluded.avatar_url;
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fill profiles for any existing users
insert into public.profiles (id, full_name, avatar_url, role)
select 
  id,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  coalesce(
    raw_user_meta_data->>'avatar_url', 
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || id::text
  ),
  'Innovator'
from auth.users
on conflict (id) do nothing;
