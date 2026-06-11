-- Supabase Database Migration File
-- Create tables: posts, votes, comments, views
-- Set up Row Level Security (RLS) policies and trigger-based aggregates

-- 1. Create Posts Table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text not null,
  type text not null check (type in ('problem', 'idea')),
  image_url text,
  external_link text,
  upvotes integer default 0 not null,
  downvotes integer default 0 not null,
  comments_count integer default 0 not null,
  views_count integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Votes Table (Unique per user/post)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, post_id)
);

-- 3. Create Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Views Table (Unique per post per user or IP address)
create table if not exists public.views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade not null,
  ip_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (post_id, user_id),
  unique (post_id, ip_address)
);

-- 5. Create Indexes for High Performance Querying
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_type_idx on public.posts (type);
create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists votes_post_id_idx on public.votes (post_id);
create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_created_at_idx on public.comments (created_at asc);
create index if not exists views_post_id_idx on public.views (post_id);

-- 6. Trigger to Update Upvote/Downvote Counters in Posts Table
create or replace function public.handle_vote_changes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.vote_type = 'up' then
      update public.posts set upvotes = upvotes + 1 where id = new.post_id;
    elsif new.vote_type = 'down' then
      update public.posts set downvotes = downvotes + 1 where id = new.post_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.vote_type = 'up' and new.vote_type = 'down' then
      update public.posts set upvotes = upvotes - 1, downvotes = downvotes + 1 where id = new.post_id;
    elsif old.vote_type = 'down' and new.vote_type = 'up' then
      update public.posts set upvotes = upvotes + 1, downvotes = downvotes - 1 where id = new.post_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.vote_type = 'up' then
      update public.posts set upvotes = upvotes - 1 where id = old.post_id;
    elsif old.vote_type = 'down' then
      update public.posts set downvotes = downvotes - 1 where id = old.post_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists votes_count_trigger on public.votes;
create trigger votes_count_trigger
after insert or update or delete on public.votes
for each row execute function public.handle_vote_changes();

-- 7. Trigger to Update Comments Count in Posts Table
create or replace function public.handle_comment_changes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = comments_count - 1 where id = old.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists comments_count_trigger on public.comments;
create trigger comments_count_trigger
after insert or delete on public.comments
for each row execute function public.handle_comment_changes();

-- 8. Trigger to Update Views Count in Posts Table
create or replace function public.handle_view_changes()
returns trigger as $$
begin
  update public.posts set views_count = views_count + 1 where id = new.post_id;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists views_count_trigger on public.views;
create trigger views_count_trigger
after insert on public.views
for each row execute function public.handle_view_changes();

-- 9. Enable Row Level Security (RLS)
alter table public.posts enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.views enable row level security;

-- 10. RLS Policies
-- Posts Policies
create policy "Allow public read on posts" on public.posts for select using (true);
create policy "Allow insert on posts for creator" on public.posts for insert with check (auth.uid() = user_id);
create policy "Allow update on posts for owner" on public.posts for update using (auth.uid() = user_id);
create policy "Allow delete on posts for owner" on public.posts for delete using (auth.uid() = user_id);

-- Votes Policies
create policy "Allow public read on votes" on public.votes for select using (true);
create policy "Allow insert on votes for self" on public.votes for insert with check (auth.uid() = user_id);
create policy "Allow update on votes for owner" on public.votes for update using (auth.uid() = user_id);
create policy "Allow delete on votes for owner" on public.votes for delete using (auth.uid() = user_id);

-- Comments Policies
create policy "Allow public read on comments" on public.comments for select using (true);
create policy "Allow insert on comments for auth" on public.comments for insert with check (auth.uid() = user_id);
create policy "Allow update on comments for owner" on public.comments for update using (auth.uid() = user_id);
create policy "Allow delete on comments for owner" on public.comments for delete using (auth.uid() = user_id);

-- Views Policies
create policy "Allow public read on views" on public.views for select using (true);
create policy "Allow insert on views for anyone" on public.views for insert with check (true);

-- 11. Storage Setup for Post Images
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "Public Read Storage" on storage.objects for select using (bucket_id = 'post-images');
create policy "Authenticated Write Storage" on storage.objects for insert with check (bucket_id = 'post-images' and auth.role() = 'authenticated');
