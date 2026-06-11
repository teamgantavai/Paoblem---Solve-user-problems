-- Create secure RPC function to check if email exists in auth.users
create or replace function public.check_email_exists(email_to_check text)
returns boolean as $$
declare
  exists_flag boolean;
begin
  select exists(select 1 from auth.users where email = email_to_check) into exists_flag;
  return exists_flag;
end;
$$ language plpgsql security definer;

-- Grant execution permissions to public (anon/authenticated)
grant execute on function public.check_email_exists(text) to anon, authenticated, service_role;
