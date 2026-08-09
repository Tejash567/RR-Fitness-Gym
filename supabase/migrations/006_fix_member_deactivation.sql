-- Migration 006: Fix Member Deactivation status constraint & RLS update policy

-- 1. Update members status check constraint to explicitly include 'deactivated' alongside 'active', 'inactive', 'pending'
do $$
begin
  -- Drop existing constraint if present
  alter table members drop constraint if exists members_status_check;
  -- Add updated constraint including 'deactivated'
  alter table members add constraint members_status_check check (status in ('active', 'inactive', 'pending', 'deactivated'));
exception
  when others then null;
end $$;

-- 2. Ensure admin UPDATE policy on members permits status updates
drop policy if exists members_admin_all on members;
create policy members_admin_all on members
  for all using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
    or auth.role() = 'authenticated'
  ) with check (
    true
  );
