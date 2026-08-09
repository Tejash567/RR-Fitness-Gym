'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Calendar,
  CreditCard,
  DollarSign,
  Dumbbell,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Share2,
  Sliders,
  Users,
  X,
} from 'lucide-react';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/attendance', label: 'Attendance', icon: Activity },
  { href: '/admin/expenses', label: 'Expenses', icon: DollarSign },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
  { href: '/admin/plans', label: 'Plans', icon: Dumbbell },
  { href: '/admin/announcements', label: 'Announcements', icon: Bell },
  { href: '/admin/content', label: 'Content', icon: Globe },
  { href: '/admin/gallery', label: 'Gallery', icon: ImageIcon },
  { href: '/admin/social', label: 'Social', icon: Share2 },
  { href: '/admin/settings', label: 'Settings', icon: Sliders },
];

type ProfileState = {
  role: string | null;
  full_name: string | null;
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'ready' | 'guest'>('loading');
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client || !isSupabaseConfigured()) {
      setError(
        'Supabase is not configured yet. Add environment variables from .env.example to enable admin data access.'
      );
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

      const { data, error: profileError } = await client
        .from('profiles')
        .select('role, full_name')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setStatus('guest');
        return;
      }

      if (!data || data.role !== 'admin') {
        setError('Only authorized admin accounts can access this workspace.');
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

  const currentPageLabel = useMemo(() => {
    const activeItem = navItems.find(
      (item) => item.href === pathname || (item.href !== '/admin' && pathname.startsWith(item.href))
    );
    return activeItem?.label || 'Dashboard';
  }, [pathname]);

  const greetingTitle = useMemo(() => {
    if (status === 'ready' && profile?.full_name) {
      return `Hello, ${profile.full_name}`;
    }
    return 'RR Fitness Admin';
  }, [profile, status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-zinc-400">Loading RR Fitness Admin…</span>
        </div>
      </div>
    );
  }

  if (status === 'guest') {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 p-6 text-white">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-950/80 border border-red-800 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <X size={28} />
          </div>
          <h1 className="text-xl font-extrabold text-white mb-2">Admin Access Required</h1>
          <p className="text-sm text-zinc-400 mb-6">
            {error || 'Please sign in with an authorized RR Fitness administrator account.'}
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-lg shadow-red-900/30"
          >
            Go to Admin Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row antialiased selection:bg-red-600 selection:text-white">
      {/* MOBILE TOP NAVBAR */}
      <header className="lg:hidden sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile navigation"
            className="p-2 rounded-lg bg-zinc-800/80 text-zinc-200 hover:text-white hover:bg-zinc-800 focus:outline-none"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/images/rr-fitness-logo.jpg"
              alt="RR Fitness"
              className="w-7 h-7 rounded-full border border-red-600 object-cover"
            />
            <div>
              <div className="text-xs font-black tracking-widest text-red-600 uppercase">RR FITNESS</div>
              <div className="text-sm font-bold text-white leading-none">{currentPageLabel}</div>
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
          Admin
        </div>
      </header>

      {/* MOBILE NAVIGATION DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Sheet */}
          <div className="relative w-80 max-w-[85vw] bg-zinc-950 border-r border-zinc-800 text-white flex flex-col h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/images/rr-fitness-logo.jpg"
                  alt="RR Fitness"
                  className="w-9 h-9 rounded-full border-2 border-red-600 object-cover"
                />
                <div>
                  <div className="text-xs font-extrabold tracking-widest text-red-600 uppercase">
                    RR FITNESS
                  </div>
                  <div className="text-lg font-black text-white leading-tight">Admin Portal</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-red-600 text-white font-bold shadow-md shadow-red-900/40'
                        : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'text-zinc-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout button in drawer */}
            <div className="p-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-950/70 border border-red-800/60 hover:bg-red-900 text-red-400 hover:text-white font-bold text-sm transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-zinc-950 border-r border-zinc-800/80 p-5 shrink-0 min-h-screen">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img
            src="/images/rr-fitness-logo.jpg"
            alt="RR Fitness"
            className="w-10 h-10 rounded-full border-2 border-red-600 object-cover shadow-lg"
          />
          <div>
            <div className="text-[11px] font-black tracking-widest text-red-600 uppercase">
              RR FITNESS
            </div>
            <div className="text-xl font-black text-white tracking-tight leading-none">
              Admin Portal
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-red-600 text-white font-bold shadow-md shadow-red-900/40'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-zinc-400'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-zinc-800/80 mt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-red-600 hover:border-red-600 text-zinc-300 hover:text-white font-bold text-sm transition-all"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 bg-zinc-900/40 text-zinc-100">
        {/* DESKTOP HEADER */}
        <div className="hidden lg:flex items-center justify-between mb-8 pb-4 border-b border-zinc-800/60">
          <div>
            <div className="text-xs font-black tracking-widest text-red-500 uppercase">
              Gym Management Dashboard
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">{greetingTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
              RR Fitness Admin Workspace
            </span>
          </div>
        </div>

        {/* Content */}
        {children}
      </main>
    </div>
  );
}
