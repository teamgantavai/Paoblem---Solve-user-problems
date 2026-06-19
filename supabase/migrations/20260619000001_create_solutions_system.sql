-- Add a dedicated problem-solution system.

create table if not exists public.solutions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text not null,
  image_url text,
  external_link text,
  link_name text,
  upvotes integer default 0 not null,
  downvotes integer default 0 not null,
  comments_count integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.solution_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  solution_id uuid references public.solutions(id) on delete cascade not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, solution_id)
);

create table if not exists public.solution_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  solution_id uuid references public.solutions(id) on delete cascade not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists solutions_problem_id_idx on public.solutions (problem_id);
create index if not exists solutions_user_id_idx on public.solutions (user_id);
create index if not exists solutions_created_at_idx on public.solutions (created_at desc);
create index if not exists solution_votes_solution_id_idx on public.solution_votes (solution_id);
create index if not exists solution_comments_solution_id_idx on public.solution_comments (solution_id);

create or replace function public.ensure_solution_problem()
returns trigger as $$
begin
  if not exists (select 1 from public.posts where id = new.problem_id and type = 'problem') then
    raise exception 'Solutions can only be attached to problem posts';
  end if;
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_solution_problem_trigger on public.solutions;
create trigger ensure_solution_problem_trigger
before insert or update on public.solutions
for each row execute function public.ensure_solution_problem();

create or replace function public.handle_solution_vote_changes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.vote_type = 'up' then
      update public.solutions set upvotes = upvotes + 1 where id = new.solution_id;
    elsif new.vote_type = 'down' then
      update public.solutions set downvotes = downvotes + 1 where id = new.solution_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.vote_type = 'up' and new.vote_type = 'down' then
      update public.solutions set upvotes = upvotes - 1, downvotes = downvotes + 1 where id = new.solution_id;
    elsif old.vote_type = 'down' and new.vote_type = 'up' then
      update public.solutions set upvotes = upvotes + 1, downvotes = downvotes - 1 where id = new.solution_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.vote_type = 'up' then
      update public.solutions set upvotes = upvotes - 1 where id = old.solution_id;
    elsif old.vote_type = 'down' then
      update public.solutions set downvotes = downvotes - 1 where id = old.solution_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists solution_votes_count_trigger on public.solution_votes;
create trigger solution_votes_count_trigger
after insert or update or delete on public.solution_votes
for each row execute function public.handle_solution_vote_changes();

create or replace function public.handle_solution_comment_changes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.solutions set comments_count = comments_count + 1 where id = new.solution_id;
  elsif tg_op = 'DELETE' then
    update public.solutions set comments_count = comments_count - 1 where id = old.solution_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists solution_comments_count_trigger on public.solution_comments;
create trigger solution_comments_count_trigger
after insert or delete on public.solution_comments
for each row execute function public.handle_solution_comment_changes();

alter table public.solutions enable row level security;
alter table public.solution_votes enable row level security;
alter table public.solution_comments enable row level security;

create policy "Allow public read on solutions" on public.solutions for select using (true);
create policy "Allow insert on solutions for creator" on public.solutions for insert with check (auth.uid() = user_id);
create policy "Allow update on solutions for owner" on public.solutions for update using (auth.uid() = user_id);
create policy "Allow delete on solutions for owner" on public.solutions for delete using (auth.uid() = user_id);

create policy "Allow public read on solution votes" on public.solution_votes for select using (true);
create policy "Allow insert on solution votes for self" on public.solution_votes for insert with check (auth.uid() = user_id);
create policy "Allow update on solution votes for owner" on public.solution_votes for update using (auth.uid() = user_id);
create policy "Allow delete on solution votes for owner" on public.solution_votes for delete using (auth.uid() = user_id);

create policy "Allow public read on solution comments" on public.solution_comments for select using (true);
create policy "Allow insert on solution comments for auth" on public.solution_comments for insert with check (auth.uid() = user_id);
create policy "Allow update on solution comments for owner" on public.solution_comments for update using (auth.uid() = user_id);
create policy "Allow delete on solution comments for owner" on public.solution_comments for delete using (auth.uid() = user_id);
