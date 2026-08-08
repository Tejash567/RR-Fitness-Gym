# RR Fitness Website

This project is a Next.js 13 + TypeScript website for RR Fitness. The public frontend provides an energetic, modern gym identity while supporting a Supabase-backed content layer and an admin dashboard.

## Architecture

- Frontend: Next.js App Router
- Styling: custom CSS in `app/globals.css` (Red/Black/White theme)
- Backend: Supabase (Auth, Database, Storage)
- Admin routes: `/admin`, `/admin/login`, `/admin/members`, `/admin/payments`, `/admin/attendance`, `/admin/plans`, `/admin/announcements`, `/admin/content`, `/admin/gallery`, `/admin/social`, `/admin/settings`

## Environment variables

Configured via `.env` with Supabase project reference `gqxbkqiejfmxnsbwrxqc`.

## Database

The SQL migrations live in `supabase/migrations/`.

## Notes

- The public site uses the real supplied RR Fitness photographs from `/public/images/`.
- The admin shell blocks access unless the signed-in account has an `admin` role in the `profiles` table.

