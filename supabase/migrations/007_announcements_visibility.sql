-- Migration 007: Add visibility column to announcements table for public vs member portal targeting

alter table announcements add column if not exists visibility text default 'BOTH';

-- Update check constraint if needed
do $$
begin
  alter table announcements drop constraint if exists announcements_visibility_check;
  alter table announcements add constraint announcements_visibility_check check (visibility in ('PUBLIC', 'MEMBER', 'BOTH'));
exception
  when others then null;
end $$;
