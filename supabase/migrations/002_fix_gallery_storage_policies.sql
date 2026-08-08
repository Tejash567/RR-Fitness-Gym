-- Fix Storage policies for library-gallery bucket
-- This migration ensures proper access control for gallery image uploads and public access

-- Insert storage policies if they don't exist
-- Note: Storage policies are managed differently from table policies
-- These policies allow public read access and admin upload access

-- Create a bucket if it doesn't exist (for initial setup)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-gallery', 'library-gallery', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Public read policy for gallery images
-- Allows anyone to read images from the bucket
drop policy if exists "library-gallery_public_read" on storage.objects;
create policy "library-gallery_public_read"
on storage.objects for select
using (bucket_id = 'library-gallery');

-- Admin upload policy for gallery images
-- Allows authenticated admins to upload images
drop policy if exists "library-gallery_admin_upload" on storage.objects;
create policy "library-gallery_admin_upload"
on storage.objects for insert
with check (
  bucket_id = 'library-gallery' and
  exists (
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Admin delete policy for gallery images
-- Allows authenticated admins to delete images
drop policy if exists "library-gallery_admin_delete" on storage.objects;
create policy "library-gallery_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'library-gallery' and
  exists (
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Admin update policy for gallery images
-- Allows authenticated admins to update images
drop policy if exists "library-gallery_admin_update" on storage.objects;
create policy "library-gallery_admin_update"
on storage.objects for update
using (
  bucket_id = 'library-gallery' and
  exists (
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  bucket_id = 'library-gallery' and
  exists (
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  )
);
