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
  RefreshCw,
  User,
  X,
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
  photo_url?: string | null;
  notes: string | null;
  membership_plans?: {
    id?: string;
    name: string;
    price: string;
    duration_days: number;
  } | null;
};

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  duration_days: number;
  features: string[];
  is_active: boolean;
  display_order: number;
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
    return { label: 'Deactivated', color: '#ef4444', bg: '#271214', border: '#7f1d1d' };
  }
  if (!expiryDate) {
    return { label: 'Pending', color: '#f59e0b', bg: '#2d1e0f', border: '#78350f' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Expired', color: '#ef4444', bg: '#271214', border: '#7f1d1d', diffDays };
  }
  if (diffDays <= 7) {
    return { label: 'Expiring Soon', color: '#f59e0b', bg: '#2d1e0f', border: '#78350f', diffDays };
  }
  return { label: 'Active', color: '#10b981', bg: '#062c1b', border: '#047857', diffDays };
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

  // Plan Selection & Razorpay Payment state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'verifying' | 'success' | 'failed' | 'cancelled'>('idle');
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const fetchMemberDetails = async () => {
    const client = createBrowserClient();
    if (!client || !isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      router.replace('/member/login');
      return;
    }

    const { data: memberData, error: memberErr } = await client
      .from('members')
      .select('*, membership_plans(id, name, price, duration_days)')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (memberErr || !memberData) {
      setError('No member profile linked to this user account. Please contact gym administration.');
      setLoading(false);
      return;
    }

    setMember(memberData);

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

  useEffect(() => {
    fetchMemberDetails();
  }, [router]);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleOpenPlanModal = async () => {
    setIsPlanModalOpen(true);
    setPaymentState('idle');
    setPaymentMessage(null);
    setLoadingPlans(true);

    const client = createBrowserClient();
    if (client) {
      const { data } = await client
        .from('membership_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      setAvailablePlans(data ?? []);
    }
    setLoadingPlans(false);
  };

  const handleInitiateRazorpayPayment = async (plan: PlanRow) => {
    setSelectedPlanId(plan.id);
    setPaymentState('processing');
    setPaymentMessage('Preparing Razorpay payment order...');

    const client = createBrowserClient();
    if (!client) {
      setPaymentState('failed');
      setPaymentMessage('Supabase client error.');
      return;
    }

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setPaymentState('failed');
      setPaymentMessage('Session expired. Please sign in again.');
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setPaymentState('failed');
      setPaymentMessage('Failed to load Razorpay SDK. Please check your internet connection.');
      return;
    }

    try {
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan.id }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        setPaymentState('failed');
        setPaymentMessage(orderData.error || 'Failed to create payment order.');
        return;
      }

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'RR FITNESS',
        description: `Plan Renewal: ${orderData.planName}`,
        image: '/images/rr-fitness-logo.jpg',
        order_id: orderData.orderId,
        prefill: {
          name: orderData.memberName || member?.full_name || '',
          email: orderData.memberEmail || member?.email || '',
          contact: orderData.memberPhone || member?.phone || '',
        },
        theme: {
          color: '#dc2626',
        },
        handler: async (response: any) => {
          setPaymentState('verifying');
          setPaymentMessage('Verifying payment with server...');

          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: plan.id,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              setPaymentState('failed');
              setPaymentMessage(verifyData.error || 'Payment verification failed.');
              return;
            }

            setPaymentState('success');
            setPaymentMessage(`Payment successful! Membership renewed until ${verifyData.expiryDate}.`);

            // Refresh member dashboard data
            await fetchMemberDetails();
          } catch (vErr: any) {
            setPaymentState('failed');
            setPaymentMessage(vErr.message || 'Error verifying payment with server.');
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentState('cancelled');
            setPaymentMessage('Payment was cancelled.');
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on('payment.failed', (failResp: any) => {
        setPaymentState('failed');
        setPaymentMessage(failResp.error?.description || 'Payment failed.');
      });

      razorpayInstance.open();
    } catch (err: any) {
      setPaymentState('failed');
      setPaymentMessage(err.message || 'Error initializing payment.');
    }
  };

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

  const isDeactivated = member.status === 'inactive' || member.status === 'deactivated';
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
        {/* Deactivated Notice if admin turned off access */}
        {isDeactivated && (
          <div style={{ background: '#271214', border: '1px solid #7f1d1d', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <AlertCircle size={28} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, color: '#fca5a5', fontSize: 16 }}>Account Access Deactivated</div>
              <div style={{ fontSize: 13, color: '#f87171', marginTop: 2 }}>
                Your member portal account is currently disabled by gym administration. Please contact the front desk or owner to reactivate your membership.
              </div>
            </div>
          </div>
        )}

        {/* Welcome Header */}
        <div style={{ background: 'linear-gradient(135deg, #18181b 0%, #121215 100%)', border: '1px solid #27272a', borderRadius: 16, padding: '24px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.full_name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #dc2626' }} />
            ) : null}
            <div>
              <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                WELCOME BACK
              </div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#ffffff' }}>{member.full_name.toUpperCase()}</h1>
              <div style={{ marginTop: 6, fontSize: 13, color: '#a1a1aa', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <span>Member ID: <strong>{member.member_id || 'N/A'}</strong></span>
                {member.phone && <span>Phone: {member.phone}</span>}
              </div>
            </div>
          </div>

          <div style={{ padding: '8px 16px', borderRadius: 20, background: statusMeta.bg, border: `1px solid ${statusMeta.border}`, color: statusMeta.color, fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} /> {statusMeta.label}
          </div>
        </div>

        {/* Status Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {/* Plan Card */}
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
                  <Dumbbell size={20} />
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>CURRENT PLAN</span>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff' }}>
                {member.membership_plans?.name || 'General Membership'}
              </div>
              <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4 }}>
                Expires: <strong>{member.expiry_date || 'N/A'}</strong>
              </div>
              {typeof statusMeta.diffDays === 'number' && (
                <div style={{ marginTop: 8, fontSize: 12, color: statusMeta.diffDays < 0 ? '#ef4444' : statusMeta.diffDays <= 7 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                  {statusMeta.diffDays < 0 ? `${Math.abs(statusMeta.diffDays)} days expired` : `${statusMeta.diffDays} days remaining`}
                </div>
              )}
            </div>

            <button
              disabled={isDeactivated}
              onClick={handleOpenPlanModal}
              style={{
                marginTop: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: isDeactivated ? '#27272a' : '#dc2626',
                color: isDeactivated ? '#71717a' : '#ffffff',
                border: 0,
                fontWeight: 800,
                fontSize: 13,
                cursor: isDeactivated ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'center',
              }}

            >
              <Zap size={16} /> Change / Renew Plan
            </button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
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

      {/* Plan Selection Modal */}
      {isPlanModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 100 }}>
          <div style={{ maxWidth: 640, width: '100%', background: '#121215', border: '1px solid #27272a', borderRadius: 16, padding: 24, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid #27272a', paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#ffffff' }}>Select Membership Plan</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>Choose a plan to extend or renew your RR Fitness membership.</p>
              </div>
              <button onClick={() => setIsPlanModalOpen(false)} style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Payment Feedback Banner */}
            {paymentState !== 'idle' && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  marginBottom: 20,
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background:
                    paymentState === 'success'
                      ? '#062c1b'
                      : paymentState === 'failed'
                      ? '#271214'
                      : paymentState === 'cancelled'
                      ? '#2d1e0f'
                      : '#18181b',
                  border: `1px solid ${
                    paymentState === 'success'
                      ? '#047857'
                      : paymentState === 'failed'
                      ? '#7f1d1d'
                      : paymentState === 'cancelled'
                      ? '#78350f'
                      : '#27272a'
                  }`,
                  color:
                    paymentState === 'success'
                      ? '#34d399'
                      : paymentState === 'failed'
                      ? '#fca5a5'
                      : paymentState === 'cancelled'
                      ? '#fcd34d'
                      : '#ffffff',
                }}
              >
                {(paymentState === 'processing' || paymentState === 'verifying') && <RefreshCw className="animate-spin" size={18} />}
                {paymentState === 'success' && <CheckCircle2 size={18} />}
                {paymentState === 'failed' && <AlertCircle size={18} />}
                <span>
                  {paymentState === 'processing' && (paymentMessage || 'Processing...')}
                  {paymentState === 'verifying' && (paymentMessage || 'Verifying Razorpay payment...')}
                  {paymentState === 'success' && (paymentMessage || 'Payment Successful')}
                  {paymentState === 'failed' && (paymentMessage || 'Payment Failed')}
                  {paymentState === 'cancelled' && (paymentMessage || 'Payment Cancelled')}
                </span>
              </div>
            )}

            {loadingPlans ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#a1a1aa' }}>Loading available plans…</div>
            ) : availablePlans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#a1a1aa' }}>No active membership plans available. Please contact front desk.</div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {availablePlans.map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      background: '#18181b',
                      border: selectedPlanId === plan.id ? '2px solid #dc2626' : '1px solid #27272a',
                      borderRadius: 12,
                      padding: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{plan.name}</div>
                      <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 2 }}>{plan.duration_days} days validity</div>
                      {plan.description && <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>{plan.description}</div>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626' }}>
                          ₹{plan.price}
                        </div>
                      </div>
                      <button
                        disabled={paymentState === 'processing' || paymentState === 'verifying'}
                        onClick={() => handleInitiateRazorpayPayment(plan)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 8,
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 0,
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        Select & Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
