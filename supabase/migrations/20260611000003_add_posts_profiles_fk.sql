-- Add explicit foreign key constraint from posts.user_id to profiles.id for PostgREST joins
alter table public.posts
drop constraint if exists posts_user_id_fkey;

alter table public.posts
add constraint posts_user_id_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;
