-- Migration: Add cover_url to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
  END IF;
END
$$;

-- Update handle_new_user trigger to support cover_url
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger as $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role, cover_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(
      new.raw_user_meta_data->>'avatar_url', 
      'https://api.dicebear.com/7.x/bottts/svg?seed=' || encode(hmac(new.id::text, 'seed', 'sha256'), 'hex')
    ),
    coalesce(new.raw_user_meta_data->>'role', 'Innovator'),
    new.raw_user_meta_data->>'cover_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      cover_url = coalesce(excluded.cover_url, profiles.cover_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
