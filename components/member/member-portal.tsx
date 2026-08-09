'use client';

import { type FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Dumbbell,
  LogOut,
  Megaphone,
  User,
  Zap,
} from 'lucide-react';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

type MemberData = {
  id: string;
  member_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  status: string;
  start_date: string | null;
  expiry_date: string | null;
  membership_plan_id: string | null;
  notes: string | null;
  membership_plans?: {
    name: string;
    price: string;
    duration_days: number;
  } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
};

type AttendanceRow = {
  id: string;
  attendance_date: string;
  entry_time: string | null;
  exit_time: string | null;
  source: string | null;
};

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  start_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function getStatusMeta(expiryDate: string | null, rawStatus: string) {
  if (rawStatus === 'inactive' || rawStatus === 'deactivated') {
    return { label: 'Deactivated', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' };
  }
  if (!expiryDate) {
    return { label: 'Pending', color: '#f59e0b', bg: '#fffbe finished', border: '#fcd34d' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Expired', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', diffDays };
  }
  if (diffDays <= 7) {
    return { label: 'Expiring Soon', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', diffDays };
  }
  return { label: 'Active', color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', diffDays };
}

export function MemberLoginPage() {
  const router = useRouter();
  const [memberCode, setMemberCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const client = createBrowserClient();
    if (!client || !isSupabaseConfigured()) {
      setError('Supabase authentication is not configured.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberCode: memberCode.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.session) {
        setError(data.error || 'Invalid Member ID or password.');
        setLoading(false);
        return;
      }

      await client.auth.setSession(data.session);
      router.replace('/member/dashboard');
    } catch (err: any) {
      setError('Invalid Member ID or password.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', display: 'grid', placeItems: 'center', padding: '24px 16px' }}>
      <div style={{ maxWidth: 420, width: '100%', background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: '50%', border: '2px solid #dc2626', overflow: 'hidden' }}>
            <img src="/images/rr-fitness-logo.jpg" alt="RR Fitness logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>RR FITNESS</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Member Portal Login</p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', background: '#271214', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#d4d4d8', marginBottom: 6 }}>Member ID</label>
            <input
              type="text"
              required
              value={memberCode}
              onChange={(e) => setMemberCode(e.target.value)}
              placeholder="e.g. RR-F-0001"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, background: '#18181b', border: '1px solid #27272a', color: '#ffffff', fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#d4d4d8', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, background: '#18181b', border: '1px solid #27272a', color: '#ffffff', fontSize: 14 }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: 0,
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: 6,
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in to Member Portal'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#71717a' }}>
          Need assistance with your member account? Contact gym management or visit the front desk.
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/" style={{ color: '#dc2626', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            ← Back to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MemberDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberData | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client || !isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const init = async () => {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) {
        router.replace('/member/login');
        return;
      }

      // Fetch member profile linked to auth user
      const { data: memberData, error: memberErr } = await client
        .from('members')
        .select('*, membership_plans(name, price, duration_days)')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (memberErr || !memberData) {
        setError('No member profile linked to this user account. Please contact gym administration.');
        setLoading(false);
        return;
      }

      setMember(memberData);

      // Fetch member payments & attendance & announcements
      const [paymentsRes, attendanceRes, announcementsRes] = await Promise.all([
        client.from('payments').select('id, amount, payment_date, payment_method, reference, notes').eq('member_id', memberData.id).order('payment_date', { ascending: false }),
        client.from('attendance').select('id, attendance_date, entry_time, exit_time, source').eq('member_id', memberData.id).order('attendance_date', { ascending: false }),
        client.from('announcements').select('id, title, content, start_at, expires_at, created_at').eq('is_active', true).order('created_at', { ascending: false }),
      ]);

      setPayments(paymentsRes.data ?? []);
      setAttendance(attendanceRes.data ?? []);

      const nowStr = new Date().toISOString().slice(0, 10);
      const filteredAnnouncements = (announcementsRes.data ?? []).filter((item) => {
        if (item.expires_at && item.expires_at < nowStr) return false;
        if (item.start_at && item.start_at > nowStr) return false;
        return true;
      });
      setAnnouncements(filteredAnnouncements);

      setLoading(false);
    };

    init();
  }, [router]);

  const handleLogout = async () => {
    const client = createBrowserClient();
    if (client) {
      await client.auth.signOut();
    }
    router.replace('/member/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#ffffff', display: 'grid', placeItems: 'center' }}>
        Loading your member profile…
      </div>
    );
  }

  if (error || !member) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#ffffff', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 500, background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 12px' }}>Member Portal Access</h2>
          <p style={{ color: '#a1a1aa' }}>{error || 'Unable to load member information.'}</p>
          <button onClick={handleLogout} style={{ marginTop: 16, padding: '10px 18px', background: '#dc2626', color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const statusMeta = getStatusMeta(member.expiry_date, member.status);
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const thisMonthVisits = attendance.filter((a) => a.attendance_date.startsWith(currentMonthStr)).length;

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5' }}>
      {/* Top Navbar */}
      <header style={{ background: '#121215', borderBottom: '1px solid #27272a', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/images/rr-fitness-logo.jpg" alt="RR Fitness" style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #dc2626', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>RR FITNESS</div>
              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Member Portal</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 48px', display: 'grid', gap: 24 }}>
        {/* Welcome Header */}
        <div style={{ background: 'linear-gradient(135deg, #18181b 0%, #121215 100%)', border: '1px solid #27272a', borderRadius: 16, padding: '24px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
              WELCOME BACK
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#ffffff' }}>{member.full_name.toUpperCase()}</h1>
            <div style={{ marginTop: 6, fontSize: 13, color: '#a1a1aa', display: 'flex', gap: 16 }}>
              <span>Member ID: <strong>{member.member_id || 'N/A'}</strong></span>
              {member.phone && <span>Phone: {member.phone}</span>}
            </div>
          </div>

          <div style={{ padding: '8px 16px', borderRadius: 20, background: statusMeta.bg, border: `1px solid ${statusMeta.border}`, color: statusMeta.color, fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} /> {statusMeta.label}
          </div>
        </div>

        {/* Status Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {/* Plan Card */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', marginBottom: 12 }}>
              <Dumbbell size={20} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>CURRENT PLAN</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>
              {member.membership_plans?.name || 'General Membership'}
            </div>
            <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4 }}>
              Expires: <strong>{member.expiry_date || 'N/A'}</strong>
            </div>
            {typeof statusMeta.diffDays === 'number' && (
              <div style={{ marginTop: 12, fontSize: 12, color: statusMeta.diffDays < 0 ? '#ef4444' : statusMeta.diffDays <= 7 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                {statusMeta.diffDays < 0 ? `${Math.abs(statusMeta.diffDays)} days expired` : `${statusMeta.diffDays} days remaining`}
              </div>
            )}
          </div>

          {/* Attendance Stat Card */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', marginBottom: 12 }}>
              <Activity size={20} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>THIS MONTH VISITS</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#ffffff' }}>{thisMonthVisits}</div>
            <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4 }}>
              Total lifetime visits: <strong>{attendance.length}</strong>
            </div>
          </div>

          {/* Last Payment Card */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', marginBottom: 12 }}>
              <CreditCard size={20} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>LAST PAYMENT</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>
              {payments.length ? `₹${payments[0].amount}` : 'No payments'}
            </div>
            <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4 }}>
              {payments.length ? `Paid on ${payments[0].payment_date} via ${payments[0].payment_method.toUpperCase()}` : 'No recent transaction'}
            </div>
          </div>
        </div>

        {/* Section: Gym Notices */}
        {announcements.length > 0 && (
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', marginBottom: 16 }}>
              <Megaphone size={20} />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Gym Announcements</h2>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {announcements.map((ann) => (
                <div key={ann.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: 16 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#ffffff' }}>{ann.title}</h3>
                  <p style={{ margin: 0, fontSize: 14, color: '#d4d4d8', lineHeight: 1.5 }}>{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Attendance History & Payments Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {/* Attendance Log */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Recent Attendance</h2>
              <span style={{ fontSize: 12, color: '#71717a' }}>Last 10 visits</span>
            </div>

            {attendance.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {attendance.slice(0, 10).map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #27272a', paddingBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 14 }}>{item.attendance_date}</div>
                      <div style={{ fontSize: 12, color: '#71717a' }}>Source: {item.source || 'manual'}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: '#a1a1aa' }}>
                      <div>In: {item.entry_time || '—'}</div>
                      <div>Out: {item.exit_time || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#71717a', fontSize: 14, padding: '16px 0' }}>No attendance records found.</div>
            )}
          </div>

          {/* Payment History */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Payment History</h2>
              <span style={{ fontSize: 12, color: '#71717a' }}>All transactions</span>
            </div>

            {payments.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #27272a', paddingBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: 15 }}>₹{p.amount}</div>
                      <div style={{ fontSize: 12, color: '#71717a' }}>Method: {p.payment_method.toUpperCase()} {p.reference ? `(${p.reference})` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: '#a1a1aa' }}>
                      {p.payment_date}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#71717a', fontSize: 14, padding: '16px 0' }}>No payment records found.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
