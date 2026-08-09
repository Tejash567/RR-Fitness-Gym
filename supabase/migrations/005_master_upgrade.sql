-- Migration 005: RR Fitness Master Upgrade
-- Safe, additive migration preserving all existing database structures and data.

-- 1. Enhance members table for photo storage and portal settings
alter table members add column if not exists photo_url text;
alter table members add column if not exists photo_storage_path text;
alter table members add column if not exists portal_enabled boolean default true;

-- 2. Create membership_adjustments table for permanent admin extra day tracking
create table if not exists membership_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  previous_expiry date not null,
  days_added integer not null,
  new_expiry date not null,
  daily_rate numeric(10,2) default 0.00,
  calculated_charge numeric(10,2) default 0.00,
  final_charge numeric(10,2) default 0.00,
  is_free boolean not null default true,
  reason text not null,
  notes text,
  admin_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Create extra_charges table for separate fees and fines
create table if not exists extra_charges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  amount numeric(10,2) not null,
  reason text not null,
  notes text,
  charge_date date not null default CURRENT_DATE,
  status text not null default 'UNPAID' check (status in ('UNPAID', 'PAID')),
  payment_id uuid references payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Enhance announcements table for banner type, priority, and images
alter table announcements add column if not exists type text default 'General';
alter table announcements add column if not exists priority text default 'medium';
alter table announcements add column if not exists image_url text;

-- 5. Enhance attendance table with unique event identifier for biometric gateway sync
alter table attendance add column if not exists event_id text unique;

-- 6. Setup Supabase Storage bucket for member-photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Storage RLS policies for member-photos
drop policy if exists "member-photos_public_read" on storage.objects;
create policy "member-photos_public_read"
on storage.objects for select
using (bucket_id = 'member-photos');

drop policy if exists "member-photos_admin_all" on storage.objects;
create policy "member-photos_admin_all"
on storage.objects for all
using (
  bucket_id = 'member-photos' and
  exists (
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  bucket_id = 'member-photos' and
  exists (
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- 7. Enable RLS on membership_adjustments
alter table membership_adjustments enable row level security;

drop policy if exists adjustments_admin_all on membership_adjustments;
create policy adjustments_admin_all on membership_adjustments
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists adjustments_self_read on membership_adjustments;
create policy adjustments_self_read on membership_adjustments
  for select using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- 8. Enable RLS on extra_charges
alter table extra_charges enable row level security;

drop policy if exists extra_charges_admin_all on extra_charges;
create policy extra_charges_admin_all on extra_charges
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists extra_charges_self_read on extra_charges;
create policy extra_charges_self_read on extra_charges
  for select using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );
