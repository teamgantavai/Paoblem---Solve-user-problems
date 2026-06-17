-- Migration: Add slug to posts and username to profiles
-- Auto-generates unique, SEO-friendly values and backfills existing entries safely

-- 1. Create slugify helper function
CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text AS $$
DECLARE
  l_slug text;
BEGIN
  -- Convert to lowercase, replace non-alphanumeric with hyphens, collapse multiple hyphens
  l_slug := lower(regexp_replace(value, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Trim hyphens from start and end
  l_slug := regexp_replace(l_slug, '^-+|-+$', '', 'g');
  RETURN l_slug;
END;
$$ LANGUAGE plpgsql STRICT IMMUTABLE;

-- 2. Create slugify_username helper function
CREATE OR REPLACE FUNCTION public.slugify_username(value text)
RETURNS text AS $$
DECLARE
  clean text;
BEGIN
  -- Remove everything except letters, numbers, and underscores
  clean := lower(regexp_replace(value, '[^a-zA-Z0-9_]+', '', 'g'));
  if clean = '' then
    clean := 'user';
  end if;
  return clean;
END;
$$ LANGUAGE plpgsql STRICT IMMUTABLE;

-- 3. Add slug column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slug text;

-- 4. Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- 5. Trigger function to auto-assign unique slugs to posts
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger AS $$
DECLARE
  base_slug text;
  temp_slug text;
  counter integer := 1;
BEGIN
  if new.slug is null or new.slug = '' then
    base_slug := public.slugify(new.title);
    if base_slug = '' then
      base_slug := 'post';
    end if;
  else
    base_slug := public.slugify(new.slug);
  end if;
  
  temp_slug := base_slug;
  -- Loop to resolve conflicts
  while exists(select 1 from public.posts where slug = temp_slug and id != new.id) loop
    temp_slug := base_slug || '-' || counter;
    counter := counter + 1;
  end loop;
  
  new.slug := temp_slug;
  return new;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for posts
DROP TRIGGER IF EXISTS set_post_slug_trigger ON public.posts;
CREATE TRIGGER set_post_slug_trigger
BEFORE INSERT OR UPDATE OF title, slug ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_post_slug();

-- 6. Trigger function to auto-assign unique usernames to profiles
CREATE OR REPLACE FUNCTION public.set_profile_username()
RETURNS trigger AS $$
DECLARE
  base_username text;
  temp_username text;
  counter integer := 1;
BEGIN
  if new.username is null or new.username = '' then
    base_username := public.slugify_username(coalesce(new.full_name, 'user'));
  else
    base_username := public.slugify_username(new.username);
  end if;
  
  temp_username := base_username;
  -- Loop to resolve conflicts
  while exists(select 1 from public.profiles where username = temp_username and id != new.id) loop
    temp_username := base_username || counter;
    counter := counter + 1;
  end loop;
  
  new.username := temp_username;
  return new;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for profiles
DROP TRIGGER IF EXISTS set_profile_username_trigger ON public.profiles;
CREATE TRIGGER set_profile_username_trigger
BEFORE INSERT OR UPDATE OF full_name, username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_username();

-- 7. Backfill existing records
-- Backfill posts (updates slug)
UPDATE public.posts SET slug = title WHERE slug IS NULL;

-- Backfill profiles (updates username)
UPDATE public.profiles SET username = coalesce(full_name, 'user') WHERE username IS NULL;

-- 8. Add unique indexes now that data is clean and unique
CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_uidx ON public.posts (slug);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_uidx ON public.profiles (username);
