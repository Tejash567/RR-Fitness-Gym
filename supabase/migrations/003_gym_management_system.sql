-- Migration 003: Gym Management System Enhancements
-- Safe, additive migration preserving all existing database structures and data.

-- 1. Enhance members table for member_code, user auth, extended profile, and biometric preparation
alter table members add column if not exists member_code text unique;
alter table members add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table members add column if not exists dob date;
alter table members add column if not exists address text;
alter table members add column if not exists emergency_contact text;
alter table members add column if not exists device_user_id text;

-- 2. Enhance payments table for plan linking and period tracking
alter table payments add column if not exists membership_plan_id uuid references membership_plans(id) on delete set null;
alter table payments add column if not exists membership_start_date date;
alter table payments add column if not exists membership_end_date date;

-- 3. Enhance attendance table for entry source and biometric device user ID
alter table attendance add column if not exists source text default 'manual' check (source in ('manual', 'essl_x990'));
alter table attendance add column if not exists device_user_id text;

-- 4. Create expenses table for Gym Expense Management
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Electricity', 'Rent', 'Equipment', 'Maintenance', 'Staff', 'Cleaning', 'Marketing', 'Other')),
  amount numeric(10,2) not null,
  expense_date date not null,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'upi', 'bank_transfer', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Create audit_logs table for administrative trail
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details text,
  created_at timestamptz not null default now()
);

-- 6. Row Level Security for Expenses
alter table expenses enable row level security;

drop policy if exists expenses_admin_all on expenses;
create policy expenses_admin_all on expenses
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 7. Row Level Security for Audit Logs
alter table audit_logs enable row level security;

drop policy if exists audit_logs_admin_all on audit_logs;
create policy audit_logs_admin_all on audit_logs
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 8. RLS Policies for Member Portal (Self Access & Lookup)
drop policy if exists members_read_all on members;
create policy members_read_all on members
  for select using (true);

drop policy if exists members_self_read on members;
create policy members_self_read on members
  for select using (
    user_id = auth.uid()
  );

drop policy if exists payments_self_read on payments;
create policy payments_self_read on payments
  for select using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

drop policy if exists attendance_self_read on attendance;
create policy attendance_self_read on attendance
  for select using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- 9. Seed initial business information settings if not present
insert into library_settings (setting_key, setting_value, is_public)
values
  ('business_name', 'RR Fitness', true),
  ('address', '5, Roorkee, Jhabrera, Uttarakhand 247665', true),
  ('location_ref', 'Ambika Battery', true),
  ('phone_display', '063967 59176', true),
  ('whatsapp_number', '916396759176', true),
  ('hours', 'Open daily until 10 PM', true),
  ('directions_url', 'https://www.google.com/maps/search/?api=1&query=RR+Fitness%2C+5%2C+Roorkee%2C+Jhabrera%2C+Uttarakhand+247665', true)
on conflict (setting_key) do nothing;

insert into social_links (platform, url, is_active)
values
  ('instagram', 'https://www.instagram.com/rr_fitness_gym_/', true),
  ('owner_instagram', 'https://www.instagram.com/chaudhary_himanshu_ross/', true),
  ('facebook', '', true),
  ('whatsapp', '916396759176', true)
on conflict (platform) do nothing;
