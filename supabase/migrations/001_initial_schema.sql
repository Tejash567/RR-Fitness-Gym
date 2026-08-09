create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'staff')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price text,
  duration_days integer,
  features text[] default '{}',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  member_id text unique,
  full_name text not null,
  phone text not null,
  email text,
  gender text,
  membership_plan_id uuid references membership_plans(id) on delete set null,
  start_date date,
  expiry_date date,
  status text not null default 'active' check (status in ('active','inactive','pending')),
  seat_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_date date not null,
  payment_method text not null default 'cash' check (payment_method in ('cash','upi','bank_transfer','other')),
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  attendance_date date not null,
  entry_time time,
  exit_time time,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_active boolean not null default true,
  start_at date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists website_content (
  id uuid primary key default gen_random_uuid(),
  page text not null default 'home',
  content_key text not null,
  content_value text,
  content_type text not null default 'text',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page, content_key)
);

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  icon text not null default 'seats',
  title text not null,
  description text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  alt_text text,
  storage_path text not null,
  public_url text,
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists library_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table membership_plans enable row level security;
alter table members enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table announcements enable row level security;
alter table website_content enable row level security;
alter table facilities enable row level security;
alter table gallery enable row level security;
alter table social_links enable row level security;
alter table library_settings enable row level security;

drop policy if exists profiles_select_admin on profiles;
create policy profiles_select_admin on profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles
  for update using (auth.uid() = id);

drop policy if exists plans_public_read on membership_plans;
create policy plans_public_read on membership_plans
  for select using (is_active = true);

drop policy if exists plans_admin_all on membership_plans;
create policy plans_admin_all on membership_plans
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists members_admin_all on members;
create policy members_admin_all on members
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists payments_admin_all on payments;
create policy payments_admin_all on payments
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists attendance_admin_all on attendance;
create policy attendance_admin_all on attendance
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists announcements_public_read on announcements;
create policy announcements_public_read on announcements
  for select using (is_active = true);

drop policy if exists announcements_admin_all on announcements;
create policy announcements_admin_all on announcements
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists website_content_public_read on website_content;
create policy website_content_public_read on website_content
  for select using (is_active = true);

drop policy if exists website_content_admin_all on website_content;
create policy website_content_admin_all on website_content
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists facilities_public_read on facilities;
create policy facilities_public_read on facilities
  for select using (is_active = true);

drop policy if exists facilities_admin_all on facilities;
create policy facilities_admin_all on facilities
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists gallery_public_read on gallery;
create policy gallery_public_read on gallery
  for select using (is_published = true);

drop policy if exists gallery_admin_all on gallery;
create policy gallery_admin_all on gallery
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists social_public_read on social_links;
create policy social_public_read on social_links
  for select using (is_active = true);

drop policy if exists social_admin_all on social_links;
create policy social_admin_all on social_links
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists settings_public_read on library_settings;
create policy settings_public_read on library_settings
  for select using (is_public = true);

drop policy if exists settings_admin_all on library_settings;
create policy settings_admin_all on library_settings
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );
