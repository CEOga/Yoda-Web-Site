begin;

create table if not exists public.club_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.club_memberships enable row level security;
revoke all on public.club_memberships from anon, authenticated;
grant select on public.club_memberships to authenticated;

drop policy if exists "Read own club membership" on public.club_memberships;
create policy "Read own club membership"
  on public.club_memberships for select to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('club-videos', 'club-videos', false)
on conflict (id) do update set public = false;

-- Restrict direct reads even when another permissive storage policy exists.
drop policy if exists "Club videos are served by the backend" on storage.objects;
create policy "Club videos are served by the backend"
  on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id <> 'club-videos');

commit;
