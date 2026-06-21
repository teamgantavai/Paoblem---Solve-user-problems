-- Add explicit foreign key constraint from votes.user_id to profiles.id for PostgREST joins
alter table public.votes
drop constraint if exists votes_user_id_fkey;

alter table public.votes
add constraint votes_user_id_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;

-- Add explicit foreign key constraint from solution_votes.user_id to profiles.id
alter table public.solution_votes
drop constraint if exists solution_votes_user_id_fkey;

alter table public.solution_votes
add constraint solution_votes_user_id_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;
