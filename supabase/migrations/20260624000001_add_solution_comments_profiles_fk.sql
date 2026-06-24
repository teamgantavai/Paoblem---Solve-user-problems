-- Migration: Add explicit foreign key constraint from solutions.user_id and solution_comments.user_id to profiles.id for PostgREST joins

alter table public.solutions
drop constraint if exists solutions_user_id_fkey;

alter table public.solutions
add constraint solutions_user_id_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;

alter table public.solution_comments
drop constraint if exists solution_comments_user_id_fkey;

alter table public.solution_comments
add constraint solution_comments_user_id_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;
