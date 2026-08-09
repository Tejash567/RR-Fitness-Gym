'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/attendance', label: 'Attendance' },
  { href: '/admin/expenses', label: 'Expenses' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/gallery', label: 'Gallery' },
  { href: '/admin/social', label: 'Social' },
  { href: '/admin/settings', label: 'Settings' },
];

type ProfileState = {
  role: string | null;
  full_name: string | null;
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'guest'>('loading');
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client || !isSupabaseConfigured()) {
      setError('Supabase is not configured yet. Add the environment variables from .env.example to enable admin data access.');
      setStatus('guest');
      return;
    }

    const initialize = async () => {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) {
        setStatus('guest');
        router.replace('/admin/login');
        return;
      }

      const { data, error } = await client.from('profiles').select('role, full_name').eq('id', userData.user.id).maybeSingle();
      if (error) {
        setError(error.message);
        setStatus('guest');
        return;
      }

      if (!data || data.role !== 'admin') {
        setError('Only admin accounts can access this dashboard.');
        setStatus('guest');
        return;
      }

      setProfile(data);
      setStatus('ready');
    };

    initialize();
  }, [router]);

  const handleLogout = async () => {
    const client = createBrowserClient();
    if (client) {
      await client.auth.signOut();
    }
    router.replace('/admin/login');
  };

  const title = useMemo(() => {
    if (status === 'ready' && profile?.full_name) {
      return `Hello, ${profile.full_name}`;
    }
    return 'RR Fitness Admin';
  }, [profile, status]);

  if (status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fa' }}>Loading admin workspace…</div>;
  }

  if (status === 'guest') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fa', padding: 24 }}>
        <div style={{ maxWidth: 620, width: '100%', background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 16, padding: 32 }}>
          <h1 style={{ marginTop: 0, color: '#0f0f11' }}>Admin access required</h1>
          <p style={{ color: '#52525b' }}>{error || 'Sign in with an authorized RR Fitness admin account to continue.'}</p>
          <Link href="/admin/login" style={{ display: 'inline-flex', marginTop: 12, padding: '10px 14px', borderRadius: 6, background: '#dc2626', color: 'white', textDecoration: 'none', fontWeight: 600 }}>Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', color: '#0f0f11' }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside style={{ width: 260, background: '#09090b', color: 'white', padding: 24, borderRight: '1px solid #27272a' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#ef4444', fontWeight: 700 }}>RR Fitness</div>
            <div style={{ fontSize: 24, marginTop: 4, fontWeight: 900 }}>Admin Portal</div>
          </div>
          <nav style={{ display: 'grid', gap: 6 }}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} style={{ padding: '10px 12px', borderRadius: 8, color: 'white', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                {item.label}
              </Link>
            ))}
          </nav>
          <button type="button" onClick={handleLogout} style={{ marginTop: 24, width: '100%', padding: '10px 12px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Logout</button>
        </aside>
        <main style={{ flex: 1, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#dc2626', fontWeight: 700 }}>Gym Dashboard</div>
              <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800 }}>{title}</h1>
            </div>
            <div style={{ color: '#52525b', fontSize: 13 }}>Secure CMS for RR Fitness</div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

