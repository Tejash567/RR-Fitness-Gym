import AdminLayoutWrapper from '@/components/admin/admin-layout-wrapper';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // AdminLayoutWrapper is a client component that decides whether to wrap
  // the current route in the AdminShell. This allows /admin/login to render
  // the login form without being redirected by the protected shell.
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
