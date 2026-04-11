-- Add optional display name for all users; required at API layer when role = teacher.
alter table public.users
  add column if not exists display_name text;
