'use client';

import { usePathname } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  // Keep the login page (and any nested /admin/login routes) outside the protected shell
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  // All other /admin routes are protected by the AdminShell
  return <AdminShell>{children}</AdminShell>;
}
