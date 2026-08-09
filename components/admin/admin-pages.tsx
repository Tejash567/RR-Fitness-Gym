'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Dumbbell,
  Edit,
  Eye,
  FileText,
  Filter,
  Megaphone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createBrowserClient } from '@/lib/supabase';

const inputClassName =
  'w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 text-sm focus:outline-none focus:border-red-600 transition-colors';

type Row = Record<string, any>;

function Card({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xl ${className || ''}`}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60">
        <h3 className="m-0 text-white text-base sm:text-lg font-extrabold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtext,
  icon,
  color = '#dc2626',
}: {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-400 truncate pr-1">{title}</span>
        <div
          className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">{value}</div>
      {subtext && <div className="text-[11px] text-zinc-400 mt-1 truncate">{subtext}</div>}
    </div>
  );
}

// Audit logger helper
async function writeAuditLog(action: string, entity: string, entityId?: string, details?: string) {
  const client = createBrowserClient();
  if (!client) return;
  try {
    const { data: userData } = await client.auth.getUser();
    await client.from('audit_logs').insert({
      user_id: userData.user?.id || null,
      user_email: userData.user?.email || 'admin',
      action,
      entity,
      entity_id: entityId || null,
      details: details || null,
    });
  } catch (e) {
    // Fail silently for audit logs if table is unavailable
  }
}

// Helper to format currency
function formatINR(num: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
}

// Helper to calculate member status
function getCalculatedStatus(expiryDate?: string | null, rawStatus?: string) {
  if (rawStatus === 'inactive' || rawStatus === 'deactivated') return { label: 'Deactivated', color: '#ef4444' };
  if (!expiryDate) return { label: 'Pending', color: '#f59e0b' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Expired', color: '#ef4444', diffDays };
  if (diffDays <= 7) return { label: 'Expiring Soon', color: '#f59e0b', diffDays };
  return { label: 'Active', color: '#10b981', diffDays };
}

// ----------------------------------------------------
// 1. DASHBOARD PAGE
// ----------------------------------------------------
export function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    expiringSoon: 0,
    expiredMembers: 0,
    todayAttendance: 0,
    thisMonthRevenue: 0,
    thisMonthExpenses: 0,
    thisMonthProfit: 0,
  });

  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [financialChartData, setFinancialChartData] = useState<any[]>([]);
  const [memberDistData, setMemberDistData] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<Row[]>([]);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentMonthStr = todayStr.slice(0, 7);

      const [
        { data: membersData },
        { data: paymentsData },
        { data: expensesData },
        { data: attendanceData },
      ] = await Promise.all([
        client.from('members').select('id, member_code, full_name, status, expiry_date, created_at'),
        client.from('payments').select('id, amount, payment_date, payment_method, member_id, members(full_name, member_code)').order('payment_date', { ascending: false }),
        client.from('expenses').select('id, amount, expense_date'),
        client.from('attendance').select('id, attendance_date, member_id'),
      ]);

      const allMembers = membersData ?? [];
      const allPayments = paymentsData ?? [];
      const allExpenses = expensesData ?? [];
      const allAttendance = attendanceData ?? [];

      let activeCount = 0;
      let expiringSoonCount = 0;
      let expiredCount = 0;

      allMembers.forEach((m) => {
        const status = getCalculatedStatus(m.expiry_date, m.status);
        if (status.label === 'Active') activeCount++;
        else if (status.label === 'Expiring Soon') {
          activeCount++;
          expiringSoonCount++;
        } else if (status.label === 'Expired') expiredCount++;
      });

      const thisMonthPayments = allPayments.filter((p) => (p.payment_date ?? '').startsWith(currentMonthStr));
      const thisMonthRevenue = thisMonthPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

      const thisMonthExpensesList = allExpenses.filter((e) => (e.expense_date ?? '').startsWith(currentMonthStr));
      const thisMonthExpensesSum = thisMonthExpensesList.reduce((acc, e) => acc + Number(e.amount || 0), 0);

      const todayAtt = allAttendance.filter((a) => a.attendance_date === todayStr).length;

      setStats({
        totalMembers: allMembers.length,
        activeMembers: activeCount,
        expiringSoon: expiringSoonCount,
        expiredMembers: expiredCount,
        todayAttendance: todayAtt,
        thisMonthRevenue: thisMonthRevenue,
        thisMonthExpenses: thisMonthExpensesSum,
        thisMonthProfit: thisMonthRevenue - thisMonthExpensesSum,
      });

      setRecentPayments(allPayments.slice(0, 5));

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });

      const attChart = last7Days.map((dateStr) => {
        const count = allAttendance.filter((a) => a.attendance_date === dateStr).length;
        const dayLabel = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        return { date: dayLabel, visits: count };
      });
      setAttendanceChartData(attChart);

      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return d.toISOString().slice(0, 7);
      });

      const finChart = last6Months.map((mStr) => {
        const rev = allPayments.filter((p) => (p.payment_date ?? '').startsWith(mStr)).reduce((acc, p) => acc + Number(p.amount || 0), 0);
        const exp = allExpenses.filter((e) => (e.expense_date ?? '').startsWith(mStr)).reduce((acc, e) => acc + Number(e.amount || 0), 0);
        const monthLabel = new Date(`${mStr}-01`).toLocaleDateString('en-US', { month: 'short' });
        return { month: monthLabel, Revenue: rev, Expenses: exp, Profit: rev - exp };
      });
      setFinancialChartData(finChart);

      setMemberDistData([
        { name: 'Active', value: Math.max(0, activeCount - expiringSoonCount), color: '#10b981' },
        { name: 'Expiring Soon', value: expiringSoonCount, color: '#f59e0b' },
        { name: 'Expired', value: expiredCount, color: '#ef4444' },
      ]);

      setLoading(false);
    };

    loadDashboard().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-zinc-400 text-sm">Loading gym analytics…</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 bg-red-950/80 border border-red-800 rounded-xl text-red-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* 8 STAT CARDS: MOBILE 2 PER ROW, DESKTOP 4 PER ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Members" value={stats.totalMembers} icon={<Users size={18} />} color="#3b82f6" />
        <StatCard title="Active Members" value={stats.activeMembers} icon={<UserCheck size={18} />} color="#10b981" />
        <StatCard title="Expiring Soon" value={stats.expiringSoon} icon={<AlertTriangle size={18} />} color="#f59e0b" />
        <StatCard title="Expired Members" value={stats.expiredMembers} icon={<XCircle size={18} />} color="#ef4444" />
        <StatCard title="Today's Attendance" value={stats.todayAttendance} icon={<Activity size={18} />} color="#8b5cf6" />
        <StatCard title="Monthly Revenue" value={formatINR(stats.thisMonthRevenue)} icon={<DollarSign size={18} />} color="#10b981" />
        <StatCard title="Monthly Expenses" value={formatINR(stats.thisMonthExpenses)} icon={<TrendingDown size={18} />} color="#ef4444" />
        <StatCard title="Monthly Profit" value={formatINR(stats.thisMonthProfit)} icon={<TrendingUp size={18} />} color={stats.thisMonthProfit >= 0 ? '#10b981' : '#ef4444'} />
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Monthly Revenue vs Expenses vs Profit">
          {financialChartData.some((d) => d.Revenue > 0 || d.Expenses > 0) ? (
            <div className="w-full h-64 sm:h-72 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#a1a1aa" fontSize={11} />
                  <YAxis stroke="#a1a1aa" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                    formatter={(val: any) => formatINR(Number(val))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
                  <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">No financial data available</div>
          )}
        </Card>

        <Card title="Daily Attendance (Last 7 Days)">
          {attendanceChartData.some((d) => d.visits > 0) ? (
            <div className="w-full h-64 sm:h-72 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} />
                  <YAxis stroke="#a1a1aa" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                  <Line type="monotone" dataKey="visits" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">No attendance data available</div>
          )}
        </Card>
      </div>

      {/* ROW 2: DISTRIBUTION & RECENT PAYMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Member Status Distribution">
          {memberDistData.some((d) => d.value > 0) ? (
            <div className="w-full h-64 flex items-center justify-center overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={memberDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(entry) => `${entry.name}: ${entry.value}`}>
                    {memberDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">No member data available</div>
          )}
        </Card>

        <Card title="Recent Payment Transactions">
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between pb-2.5 border-b border-zinc-800/60 last:border-0">
                  <div>
                    <div className="font-bold text-white text-sm">
                      {p.members?.full_name || 'Member'} {p.members?.member_code ? `(${p.members.member_code})` : ''}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {p.payment_date} • {p.payment_method.toUpperCase()}
                    </div>
                  </div>
                  <div className="font-extrabold text-emerald-400 text-sm">{formatINR(Number(p.amount))}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 text-sm">No payment records yet.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. MEMBERS PAGE & MEMBER PROFILE VIEW
// ----------------------------------------------------
export function MembersPage() {
  const [members, setMembers] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Row | null>(null);
  const [memberPayments, setMemberPayments] = useState<Row[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Portal Account Modal state
  const [portalModal, setPortalModal] = useState<{ type: 'create' | 'reset'; member: Row } | null>(null);
  const [portalPassword, setPortalPassword] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalMsg, setPortalMsg] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ memberName: string; memberCode: string; password: string } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const [form, setForm] = useState({
    id: '',
    member_code: '',
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    dob: '',
    address: '',
    emergency_contact: '',
    membership_plan_id: '',
    start_date: '',
    expiry_date: '',
    status: 'active',
    notes: '',
  });

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const [{ data: membersData }, { data: plansData }] = await Promise.all([
      client.from('members').select('*, membership_plans(name, price)').order('created_at', { ascending: false }),
      client.from('membership_plans').select('id, name, price, duration_days').eq('is_active', true),
    ]);
    setMembers(membersData ?? []);
    setPlans(plansData ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePortalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!portalModal) return;
    setPortalLoading(true);
    setPortalMsg(null);

    try {
      const client = createBrowserClient();
      const { data: sessionRes } = (await client?.auth.getSession()) ?? {};
      const token = sessionRes?.session?.access_token;

      const res = await fetch('/api/admin/portal-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: portalModal.type === 'create' ? 'create' : 'reset_password',
          memberId: portalModal.member.id,
          password: portalPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPortalMsg(data.error || 'Failed to process portal action.');
        setPortalLoading(false);
        return;
      }

      setCreatedCredentials({
        memberName: portalModal.member.full_name,
        memberCode: data.memberCode || portalModal.member.member_code || 'RR-F-0001',
        password: portalPassword,
      });

      setMessage(data.message || 'Portal account credentials generated successfully.');
      setPortalModal(null);
      setPortalPassword('');
      await loadData();
      if (selectedMember && selectedMember.id === portalModal.member.id) {
        setSelectedMember({ ...selectedMember, user_id: data.userId || selectedMember.user_id });
      }
    } catch (err: any) {
      setPortalMsg(err.message || 'Error processing portal action.');
    } finally {
      setPortalLoading(false);
    }
  };

  const openProfileModal = async (member: Row) => {
    setSelectedMember(member);
    const client = createBrowserClient();
    if (!client) return;

    const [{ data: paymentsData }, { data: attendanceData }] = await Promise.all([
      client.from('payments').select('*, membership_plans(name)').eq('member_id', member.id).order('payment_date', { ascending: false }),
      client.from('attendance').select('*').eq('member_id', member.id).order('attendance_date', { ascending: false }),
    ]);

    setMemberPayments(paymentsData ?? []);
    setMemberAttendance(attendanceData ?? []);
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) =>
      `${m.full_name ?? ''} ${m.phone ?? ''} ${m.member_code ?? ''}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [members, search]);

  const generateMemberCode = () => {
    const existingNums = members
      .map((m) => {
        const match = (m.member_code || '').match(/RR-F-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(Boolean);
    const maxNum = existingNums.length ? Math.max(...existingNums) : 0;
    return `RR-F-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    const payload = {
      member_code: form.member_code || generateMemberCode(),
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      gender: form.gender || null,
      dob: form.dob || null,
      address: form.address || null,
      emergency_contact: form.emergency_contact || null,
      membership_plan_id: form.membership_plan_id || null,
      start_date: form.start_date || null,
      expiry_date: form.expiry_date || null,
      status: form.status,
      notes: form.notes || null,
    };

    if (form.id) {
      const { error } = await client.from('members').update(payload).eq('id', form.id);
      if (error) {
        setMessage(error.message);
        return;
      }
      await writeAuditLog('member_edited', 'members', form.id, `Updated details for member ${form.full_name}`);
    } else {
      const { error } = await client.from('members').insert(payload);
      if (error) {
        setMessage(error.message);
        return;
      }
      await writeAuditLog('member_created', 'members', undefined, `Created member ${form.full_name}`);
    }

    await loadData();
    setForm({
      id: '',
      member_code: '',
      full_name: '',
      phone: '',
      email: '',
      gender: '',
      dob: '',
      address: '',
      emergency_contact: '',
      membership_plan_id: '',
      start_date: '',
      expiry_date: '',
      status: 'active',
      notes: '',
    });
    setMessage('Member record saved successfully.');
  };

  const handleEdit = (member: Row) => {
    setForm({
      id: member.id,
      member_code: member.member_code ?? '',
      full_name: member.full_name ?? '',
      phone: member.phone ?? '',
      email: member.email ?? '',
      gender: member.gender ?? '',
      dob: member.dob ?? '',
      address: member.address ?? '',
      emergency_contact: member.emergency_contact ?? '',
      membership_plan_id: member.membership_plan_id ?? '',
      start_date: member.start_date ?? '',
      expiry_date: member.expiry_date ?? '',
      status: member.status ?? 'active',
      notes: member.notes ?? '',
    });
    setSelectedMember(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleDeactivate = async (member: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    const newStatus = member.status === 'inactive' || member.status === 'deactivated' ? 'active' : 'inactive';
    if (!window.confirm(`${newStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} member ${member.full_name}?`)) return;

    const { error } = await client.from('members').update({ status: newStatus }).eq('id', member.id);
    if (!error) {
      await writeAuditLog(newStatus === 'inactive' ? 'member_deactivated' : 'member_reactivated', 'members', member.id, `${newStatus} member ${member.full_name}`);
      await loadData();
      if (selectedMember?.id === member.id) {
        setSelectedMember({ ...selectedMember, status: newStatus });
      }
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      {/* RESPONSIVE LAYOUT GRID: SINGLE COLUMN MOBILE, 12 COLUMNS DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MEMBER LIST */}
        <div className="lg:col-span-7 space-y-4">
          <Card title={`All Gym Members (${filteredMembers.length})`}>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, or Member ID..."
                className={`${inputClassName} pl-9`}
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredMembers.map((m) => {
                const statusMeta = getCalculatedStatus(m.expiry_date, m.status);
                return (
                  <div
                    key={m.id}
                    className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-base">{m.full_name}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {m.member_code || 'No ID'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Phone: <strong className="text-zinc-300">{m.phone}</strong> • Plan: <strong className="text-zinc-300">{m.membership_plans?.name || 'Unassigned'}</strong>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Expires: <strong className="text-zinc-300">{m.expiry_date || 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-zinc-800">
                      <span
                        className="text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                        style={{ color: statusMeta.color, backgroundColor: `${statusMeta.color}20` }}
                      >
                        {statusMeta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => openProfileModal(m)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Eye size={14} /> Profile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ADD / EDIT MEMBER FORM */}
        <div className="lg:col-span-5 space-y-4">
          <Card title={form.id ? 'Edit Member Profile' : 'Add New Gym Member'}>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Member Code ID</label>
                  <input
                    value={form.member_code}
                    onChange={(e) => setForm({ ...form, member_code: e.target.value })}
                    placeholder="Auto: RR-F-0001"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Full Name *</label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Full Name"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Phone Number *</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone Number"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Email Address</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Email Address"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className={inputClassName}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Membership Plan</label>
                  <select
                    value={form.membership_plan_id}
                    onChange={(e) => {
                      const selectedPlan = plans.find((p) => p.id === e.target.value);
                      const start = form.start_date || new Date().toISOString().slice(0, 10);
                      let exp = form.expiry_date;
                      if (selectedPlan && selectedPlan.duration_days) {
                        const d = new Date(start);
                        d.setDate(d.getDate() + Number(selectedPlan.duration_days));
                        exp = d.toISOString().slice(0, 10);
                      }
                      setForm({
                        ...form,
                        membership_plan_id: e.target.value,
                        start_date: start,
                        expiry_date: exp,
                      });
                    }}
                    className={inputClassName}
                  >
                    <option value="">Select Membership Plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price} - {p.duration_days} days)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className={inputClassName}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Address & Emergency Contact</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Address"
                  className={`${inputClassName} mb-2`}
                />
                <input
                  value={form.emergency_contact}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                  placeholder="Emergency Contact Phone"
                  className={inputClassName}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition-colors shadow-lg shadow-red-900/30"
                >
                  {form.id ? 'Save Member Profile' : 'Add Gym Member'}
                </button>
                {form.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        id: '',
                        member_code: '',
                        full_name: '',
                        phone: '',
                        email: '',
                        gender: '',
                        dob: '',
                        address: '',
                        emergency_contact: '',
                        membership_plan_id: '',
                        start_date: '',
                        expiry_date: '',
                        status: 'active',
                        notes: '',
                      })
                    }
                    className="py-3 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* MEMBER PROFILE MODAL OVERLAY */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-7 shadow-2xl text-white my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-800">
              <div>
                <div className="text-xs font-black tracking-widest text-red-600 uppercase">
                  MEMBER PROFILE DETAIL
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  {selectedMember.full_name}{' '}
                  <span className="text-sm font-bold text-zinc-400">({selectedMember.member_code || 'No Code'})</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800">
                <h4 className="text-sm font-bold text-white mb-2">Personal Information</h4>
                <div className="space-y-1.5 text-xs text-zinc-300">
                  <div><strong>Phone:</strong> {selectedMember.phone}</div>
                  <div><strong>Email:</strong> {selectedMember.email || '—'}</div>
                  <div><strong>Gender:</strong> {selectedMember.gender || '—'}</div>
                  <div><strong>DOB:</strong> {selectedMember.dob || '—'}</div>
                  <div><strong>Address:</strong> {selectedMember.address || '—'}</div>
                  <div><strong>Emergency:</strong> {selectedMember.emergency_contact || '—'}</div>
                  <div><strong>Portal User Linked:</strong> {selectedMember.user_id ? 'Yes (Active)' : 'No'}</div>
                </div>
              </div>

              <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800">
                <h4 className="text-sm font-bold text-white mb-2">Membership Status</h4>
                {(() => {
                  const statusMeta = getCalculatedStatus(selectedMember.expiry_date, selectedMember.status);
                  return (
                    <div className="space-y-1.5 text-xs text-zinc-300">
                      <div><strong>Plan:</strong> {selectedMember.membership_plans?.name || 'Unassigned'}</div>
                      <div><strong>Start Date:</strong> {selectedMember.start_date || '—'}</div>
                      <div><strong>Expiry Date:</strong> {selectedMember.expiry_date || '—'}</div>
                      <div>
                        <strong>Calculated Status:</strong>{' '}
                        <span style={{ color: statusMeta.color }} className="font-extrabold">
                          {statusMeta.label}
                        </span>
                      </div>
                      {typeof statusMeta.diffDays === 'number' && (
                        <div>
                          <strong>Days Remaining:</strong>{' '}
                          {statusMeta.diffDays < 0
                            ? `Expired ${Math.abs(statusMeta.diffDays)} days ago`
                            : `${statusMeta.diffDays} days`}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-sm font-bold text-white mb-2">Payment Log ({memberPayments.length})</h4>
                {memberPayments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                          <th className="p-2">Date</th>
                          <th className="p-2">Amount</th>
                          <th className="p-2">Method</th>
                          <th className="p-2">Plan / Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {memberPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="p-2 text-zinc-300">{p.payment_date}</td>
                            <td className="p-2 font-bold text-emerald-400">{formatINR(Number(p.amount))}</td>
                            <td className="p-2 text-zinc-300">{p.payment_method.toUpperCase()}</td>
                            <td className="p-2 text-zinc-400">{p.membership_plans?.name || p.reference || 'General'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 py-2">No payment records found.</div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-2">Attendance Visits ({memberAttendance.length})</h4>
                {memberAttendance.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {memberAttendance.slice(0, 15).map((a) => (
                      <div key={a.id} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                        <div className="font-bold text-white">{a.attendance_date}</div>
                        <div className="text-zinc-400 text-[11px]">In: {a.entry_time || '—'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 py-2">No attendance logged yet.</div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleEdit(selectedMember)}
                className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => handleToggleDeactivate(selectedMember)}
                className={`py-2 px-4 rounded-xl font-bold text-xs text-white ${
                  selectedMember.status === 'inactive' || selectedMember.status === 'deactivated'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                {selectedMember.status === 'inactive' || selectedMember.status === 'deactivated'
                  ? 'Reactivate Member'
                  : 'Deactivate Member'}
              </button>
              {!selectedMember.user_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setPortalPassword('');
                    setPortalMsg(null);
                    setPortalModal({ type: 'create', member: selectedMember });
                  }}
                  className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  Create Portal Credentials
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPortalPassword('');
                    setPortalMsg(null);
                    setPortalModal({ type: 'reset', member: selectedMember });
                  }}
                  className="py-2 px-4 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 font-bold text-xs"
                >
                  Reset Portal Password
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PORTAL ACCOUNT MODAL OVERLAY */}
      {portalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-white">
            <h3 className="text-lg font-black mb-1">
              {portalModal.type === 'create' ? 'Create Portal Account' : 'Reset Portal Password'}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Member: <strong className="text-white">{portalModal.member.full_name}</strong> ({portalModal.member.member_code || 'ID'})
            </p>

            {portalMsg && (
              <div className="p-3 mb-3 bg-red-950/80 border border-red-800 rounded-xl text-red-300 text-xs">
                {portalMsg}
              </div>
            )}

            <form onSubmit={handlePortalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Portal Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClassName}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={portalLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  {portalLoading ? 'Processing…' : 'Save Credentials'}
                </button>
                <button
                  type="button"
                  onClick={() => setPortalModal(null)}
                  className="py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED CREDENTIALS OVERLAY */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm grid place-items-center p-4">
          <div className="max-w-md w-full bg-zinc-950 border-2 border-red-600 rounded-2xl p-6 text-white shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-xs font-black text-red-500 uppercase tracking-widest">RR FITNESS MEMBER PORTAL</div>
              <h3 className="text-xl font-black text-white mt-1">Credentials Generated</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Provide these login credentials to <strong>{createdCredentials.memberName}</strong>
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 mb-5">
              <div>
                <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Member ID</div>
                <div className="text-lg font-black text-white tracking-widest">{createdCredentials.memberCode}</div>
              </div>
              <div>
                <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Password</div>
                <div className="text-lg font-black text-emerald-400 tracking-widest">{createdCredentials.password}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/member/login` : '/member/login';
                  const text = `RR FITNESS MEMBER PORTAL\nMember ID: ${createdCredentials.memberCode}\nPassword: ${createdCredentials.password}\nLogin: ${url}`;
                  await navigator.clipboard.writeText(text);
                  setCopiedCreds(true);
                  setTimeout(() => setCopiedCreds(false), 2000);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Copy size={14} />
                {copiedCreds ? 'Copied!' : 'Copy Credentials'}
              </button>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 3. PAYMENTS PAGE
// ----------------------------------------------------
export function PaymentsPage() {
  const [payments, setPayments] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: '',
    member_id: '',
    membership_plan_id: '',
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash',
    membership_start_date: new Date().toISOString().slice(0, 10),
    membership_end_date: '',
    reference: '',
    notes: '',
  });

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const [{ data: paymentsData }, { data: membersData }, { data: plansData }] = await Promise.all([
      client.from('payments').select('*, members(full_name, member_code, phone), membership_plans(name)').order('payment_date', { ascending: false }),
      client.from('members').select('id, full_name, member_code, phone, status').order('created_at', { ascending: false }),
      client.from('membership_plans').select('id, name, price, duration_days').eq('is_active', true),
    ]);
    setPayments(paymentsData ?? []);
    setMembers(membersData ?? []);
    setPlans(plansData ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlanSelect = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const priceClean = String(plan.price || '').replace(/[^0-9.]/g, '');
    const startDate = form.membership_start_date || new Date().toISOString().slice(0, 10);
    const end = new Date(startDate);
    end.setDate(end.getDate() + Number(plan.duration_days || 30));

    setForm((prev) => ({
      ...prev,
      membership_plan_id: planId,
      amount: priceClean || prev.amount,
      membership_end_date: end.toISOString().slice(0, 10),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    if (!form.member_id) {
      setMessage('Please select a valid member.');
      return;
    }

    const payload = {
      member_id: form.member_id,
      membership_plan_id: form.membership_plan_id || null,
      amount: Number(form.amount),
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      membership_start_date: form.membership_start_date || null,
      membership_end_date: form.membership_end_date || null,
      reference: form.reference || null,
      notes: form.notes || null,
    };

    if (form.id) {
      const { error } = await client.from('payments').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('payment_edited', 'payments', form.id, `Updated payment of ${form.amount}`);
    } else {
      const { error } = await client.from('payments').insert(payload);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('payment_created', 'payments', undefined, `Recorded payment of ${form.amount}`);
    }

    await loadData();
    setForm({
      id: '',
      member_id: '',
      membership_plan_id: '',
      amount: '',
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: 'cash',
      membership_start_date: new Date().toISOString().slice(0, 10),
      membership_end_date: '',
      reference: '',
      notes: '',
    });
    setMessage('Payment record saved.');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this payment transaction record?')) return;
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('payments').delete().eq('id', id);
    if (!error) {
      await writeAuditLog('payment_deleted', 'payments', id, `Deleted payment record ${id}`);
      await loadData();
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch = `${p.members?.full_name ?? ''} ${p.members?.member_code ?? ''} ${p.reference ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesMethod = !methodFilter || p.payment_method === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [payments, search, methodFilter]);

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      {/* RESPONSIVE LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PAYMENT RECORDS LIST */}
        <div className="lg:col-span-7 space-y-4">
          <Card title={`Payment Records (${filteredPayments.length})`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search member, ID, reference..."
                  className={`${inputClassName} pl-9`}
                />
              </div>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className={inputClassName}
              >
                <option value="">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="razorpay">Razorpay / Online</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* MOBILE VIEW CARDS */}
            <div className="block md:hidden space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredPayments.map((p) => (
                <div key={p.id} className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-white text-sm">{p.members?.full_name || 'Member'}</div>
                      <div className="text-[11px] text-zinc-400">{p.members?.member_code || 'No ID'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-emerald-400 text-base">{formatINR(Number(p.amount))}</div>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {p.payment_method}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800">
                    <span>Date: {p.payment_date}</span>
                    <span>Plan: {p.membership_plans?.name || 'General'}</span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-400 hover:text-red-300 font-bold ml-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW TABLE */}
            <div className="hidden md:block overflow-x-auto max-h-[600px]">
              <table className="w-full text-xs text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                    <th className="p-2.5">Member</th>
                    <th className="p-2.5">Amount</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Plan</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-950/50">
                      <td className="p-2.5">
                        <div className="font-bold text-white">{p.members?.full_name}</div>
                        <div className="text-zinc-500 text-[11px]">{p.members?.member_code}</div>
                      </td>
                      <td className="p-2.5 font-extrabold text-emerald-400">{formatINR(Number(p.amount))}</td>
                      <td className="p-2.5 text-zinc-300">{p.payment_date}</td>
                      <td className="p-2.5 uppercase font-bold text-zinc-300">{p.payment_method}</td>
                      <td className="p-2.5 text-zinc-400">{p.membership_plans?.name || 'General'}</td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* RECORD PAYMENT FORM */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Record Payment Transaction">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Select Member *</label>
                <select
                  required
                  value={form.member_id}
                  onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                  className={inputClassName}
                >
                  <option value="">Choose Member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.member_code || m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Membership Plan</label>
                  <select
                    value={form.membership_plan_id}
                    onChange={(e) => handlePlanSelect(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Choose Plan (Optional)</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="e.g. 800"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className={inputClassName}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="razorpay">Razorpay / Online</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Membership Start</label>
                  <input
                    type="date"
                    value={form.membership_start_date}
                    onChange={(e) => setForm({ ...form, membership_start_date: e.target.value })}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Membership End</label>
                  <input
                    type="date"
                    value={form.membership_end_date}
                    onChange={(e) => setForm({ ...form, membership_end_date: e.target.value })}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Reference / Transaction ID</label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="UPI Ref ID or Cheque No."
                  className={inputClassName}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition-colors shadow-lg shadow-red-900/30"
              >
                Record Payment
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 4. ATTENDANCE PAGE
// ----------------------------------------------------
export function AttendancePage() {
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const [{ data: attData }, { data: memData }] = await Promise.all([
      client.from('attendance').select('*, members(full_name, member_code)').eq('attendance_date', todayStr).order('created_at', { ascending: false }),
      client.from('members').select('id, full_name, member_code, phone').eq('status', 'active'),
    ]);
    setAttendance(attData ?? []);
    setMembers(memData ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckIn = async (memberId: string) => {
    const client = createBrowserClient();
    if (!client) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTimeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

    const { error } = await client.from('attendance').insert({
      member_id: memberId,
      attendance_date: todayStr,
      entry_time: nowTimeStr,
      source: 'manual',
    });

    if (!error) {
      setMessage('Attendance checked in successfully.');
      setSelectedMemberId('');
      await loadData();
    } else {
      setMessage(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <Card title="Quick Member Check-in">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Search & Select Active Member</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select Member for Check-in</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.member_code || m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <button
                disabled={!selectedMemberId}
                onClick={() => selectedMemberId && handleCheckIn(selectedMemberId)}
                className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 ${
                  selectedMemberId
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/30'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <UserCheck size={18} /> Mark Today's Check-in
              </button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <Card title={`Today's Attendance Logs (${attendance.length})`}>
            {attendance.length > 0 ? (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {attendance.map((a) => (
                  <div key={a.id} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-white text-sm">{a.members?.full_name || 'Member'}</div>
                      <div className="text-xs text-zinc-400">{a.members?.member_code} • Source: {a.source || 'manual'}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-emerald-400">In: {a.entry_time || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 text-sm">No members checked in yet today.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. EXPENSES PAGE
// ----------------------------------------------------
export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: '',
    title: '',
    category: 'Electricity',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash',
    notes: '',
  });

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('expenses').select('*').order('expense_date', { ascending: false });
    setExpenses(data ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    const payload = {
      title: form.title,
      category: form.category,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      notes: form.notes || null,
    };

    if (form.id) {
      await client.from('expenses').update(payload).eq('id', form.id);
    } else {
      await client.from('expenses').insert(payload);
    }

    await loadData();
    setForm({
      id: '',
      title: '',
      category: 'Electricity',
      amount: '',
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: 'cash',
      notes: '',
    });
    setMessage('Expense saved.');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete expense entry?')) return;
    const client = createBrowserClient();
    if (!client) return;
    await client.from('expenses').delete().eq('id', id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card title={`Gym Expenses (${expenses.length})`}>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {expenses.map((e) => (
                <div key={e.id} className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-white text-sm">{e.title}</div>
                    <div className="text-xs text-zinc-400">
                      {e.expense_date} • <span className="text-red-400 font-bold">{e.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-extrabold text-red-400 text-base">{formatINR(Number(e.amount))}</div>
                    <button onClick={() => handleDelete(e.id)} className="text-zinc-500 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card title="Add Gym Expense">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Expense Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Electricity Bill"
                  className={inputClassName}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClassName}
                  >
                    <option value="Electricity">Electricity</option>
                    <option value="Rent">Rent</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Staff">Staff</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Amount"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className={inputClassName}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition-colors shadow-lg shadow-red-900/30"
              >
                Record Expense
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. REPORTS PAGE
// ----------------------------------------------------
export function ReportsPage() {
  const [payments, setPayments] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<Row[]>([]);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    Promise.all([
      client.from('payments').select('amount, payment_date'),
      client.from('expenses').select('amount, expense_date'),
    ]).then(([{ data: pData }, { data: eData }]) => {
      setPayments(pData ?? []);
      setExpenses(eData ?? []);
    });
  }, []);

  const totalRev = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalExp = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const netProfit = totalRev - totalExp;

  const downloadCSV = () => {
    const csvRows = ['Type,Amount,Date'];
    payments.forEach((p) => csvRows.push(`Revenue,${p.amount},${p.payment_date}`));
    expenses.forEach((e) => csvRows.push(`Expense,${e.amount},${e.expense_date}`));

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rr_fitness_financial_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Lifetime Revenue" value={formatINR(totalRev)} icon={<DollarSign size={18} />} color="#10b981" />
        <StatCard title="Lifetime Expenses" value={formatINR(totalExp)} icon={<TrendingDown size={18} />} color="#ef4444" />
        <StatCard title="Lifetime Net Profit" value={formatINR(netProfit)} icon={<TrendingUp size={18} />} color={netProfit >= 0 ? '#10b981' : '#ef4444'} />
      </div>

      <Card title="Financial Analytics Summary">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-400 m-0">
            Export all financial transaction history (revenue and expense line items) in CSV spreadsheet format for accountant auditing.
          </p>
          <button
            onClick={downloadCSV}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shrink-0"
          >
            <Download size={16} /> Download CSV Report
          </button>
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// 7. PLANS PAGE
// ----------------------------------------------------
export function PlansPage() {
  const [plans, setPlans] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    duration_days: '30',
    is_active: true,
  });

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('membership_plans').select('*').order('display_order', { ascending: true });
    setPlans(data ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    const payload = {
      name: form.name,
      description: form.description || null,
      price: form.price,
      duration_days: Number(form.duration_days),
      is_active: form.is_active,
    };

    if (form.id) {
      await client.from('membership_plans').update(payload).eq('id', form.id);
    } else {
      await client.from('membership_plans').insert(payload);
    }

    await loadData();
    setForm({ id: '', name: '', description: '', price: '', duration_days: '30', is_active: true });
    setMessage('Membership plan saved.');
  };

  const handleToggleActive = async (plan: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    await client.from('membership_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card title={`Active Gym Plans (${plans.length})`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-base">{p.name}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          p.is_active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="text-xl font-black text-red-500 mt-2">₹{p.price}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{p.duration_days} Days validity</div>
                    {p.description && <div className="text-xs text-zinc-500 mt-2">{p.description}</div>}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex gap-2">
                    <button
                      onClick={() =>
                        setForm({
                          id: p.id,
                          name: p.name,
                          description: p.description || '',
                          price: p.price,
                          duration_days: String(p.duration_days),
                          is_active: p.is_active,
                        })
                      }
                      className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold ${
                        p.is_active ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card title={form.id ? 'Edit Membership Plan' : 'Create New Membership Plan'}>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Plan Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Monthly General"
                  className={inputClassName}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Price (₹) *</label>
                  <input
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="800"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    required
                    value={form.duration_days}
                    onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                    placeholder="30"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Description / Features</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Full gym equipment access, cardio zone..."
                  className={inputClassName}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition-colors shadow-lg shadow-red-900/30"
              >
                Save Plan
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 8. ANNOUNCEMENTS PAGE
// ----------------------------------------------------
export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    await client.from('announcements').insert({ title, content, is_active: true });
    await loadData();
    setTitle('');
    setContent('');
    setMessage('Announcement published.');
  };

  const handleDelete = async (id: string) => {
    const client = createBrowserClient();
    if (!client) return;
    await client.from('announcements').delete().eq('id', id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card title="Active Announcements">
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {announcements.map((a) => (
                <div key={a.id} className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-white text-sm m-0">{a.title}</h4>
                    <button onClick={() => handleDelete(a.id)} className="text-zinc-500 hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 m-0 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card title="Post Gym Announcement">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Gym Holiday Timings"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Content Notice *</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Details regarding holiday hours..."
                  className={inputClassName}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition-colors shadow-lg shadow-red-900/30"
              >
                Publish Notice
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 9. CONTENT PAGE
// ----------------------------------------------------
export function ContentPage() {
  const [contents, setContents] = useState<Row[]>([]);
  const [key, setKey] = useState('hero_title');
  const [value, setValue] = useState('');

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('website_content').select('*').then(({ data }) => setContents(data ?? []));
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    await client.from('website_content').upsert({ page: 'home', content_key: key, content_value: value });
    const { data } = await client.from('website_content').select('*');
    setContents(data ?? []);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title="Public Website Content Entries">
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
            {contents.map((c) => (
              <div key={c.id} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                <div className="font-bold text-red-400 text-xs">{c.content_key}</div>
                <div className="text-xs text-zinc-300 mt-1">{c.content_value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <Card title="Update Website Content">
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Content Key</label>
              <select value={key} onChange={(e) => setKey(e.target.value)} className={inputClassName}>
                <option value="hero_title">Hero Headline</option>
                <option value="hero_subtitle">Hero Subtitle</option>
                <option value="about_text">About RR Fitness Text</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Content Text</label>
              <textarea
                rows={4}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter content..."
                className={inputClassName}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm"
            >
              Save Website Content
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 10. GALLERY PAGE
// ----------------------------------------------------
export function GalleryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [form, setForm] = useState({ id: '', title: '', category: '', alt_text: '', is_published: true, storage_path: '', public_url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('gallery').select('*').order('display_order', { ascending: true }).then(({ data }) => setItems(data ?? []));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    let publicUrl = form.public_url;
    let storagePath = form.storage_path;

    if (file) {
      const fileName = `gallery_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadRes, error: uploadErr } = await client.storage.from('gallery-images').upload(fileName, file);
      if (uploadErr) {
        setMessage(`Storage Upload Error: ${uploadErr.message}`);
        return;
      }
      storagePath = uploadRes.path;
      const { data: urlData } = client.storage.from('gallery-images').getPublicUrl(fileName);
      publicUrl = urlData.publicUrl;
    }

    const payload = {
      title: form.title,
      category: form.category || 'Gym',
      alt_text: form.alt_text || form.title,
      storage_path: storagePath || 'gallery/default.jpg',
      public_url: publicUrl || '/images/rr-fitness-logo.jpg',
      is_published: true,
    };

    if (form.id) {
      const { error } = await client.from('gallery').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
    } else {
      if (!file) { setMessage('Please select an image file to upload.'); return; }
      const { error } = await client.from('gallery').insert(payload);
      if (error) { setMessage(error.message); return; }
    }

    const { data } = await client.from('gallery').select('*').order('display_order', { ascending: true });
    setItems(data ?? []);
    setForm({ id: '', title: '', category: '', alt_text: '', is_published: true, storage_path: '', public_url: '' });
    setFile(null);
    setMessage('Gallery photo saved successfully.');
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-sm font-medium">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card title={`Gallery Photos (${items.length})`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => (
                <div key={item.id} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
                  {item.public_url && (
                    <img src={item.public_url} alt={item.title} className="w-full h-32 object-cover rounded-lg" />
                  )}
                  <div className="font-bold text-white text-sm">{item.title}</div>
                  <div className="text-xs text-zinc-400">{item.category}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card title="Upload Photo to Gallery">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Photo Title"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Workouts, Equipment"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Image File *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className={inputClassName}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm"
              >
                Upload Gallery Photo
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 11. SOCIAL PAGE
// ----------------------------------------------------
export function SocialPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [platform, setPlatform] = useState('instagram');
  const [url, setUrl] = useState('');

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('social_links').select('*').eq('is_active', true).then(({ data }) => setRows(data ?? []));
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    await client.from('social_links').upsert({ platform, url, is_active: true });
    const { data } = await client.from('social_links').select('*').eq('is_active', true);
    setRows(data ?? []);
    setUrl('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title="Social Links & Handles">
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.platform} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                <div className="font-extrabold text-white text-sm capitalize">{row.platform}</div>
                <div className="text-xs text-zinc-400 mt-0.5 break-all">{row.url || '—'}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <Card title="Update Social Link">
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClassName}>
                <option value="instagram">RR Fitness Instagram</option>
                <option value="owner_instagram">Owner Instagram</option>
                <option value="facebook">Facebook Page</option>
                <option value="whatsapp">WhatsApp Contact</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">URL / Phone Number</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className={inputClassName}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm"
            >
              Save Link
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 12. SETTINGS PAGE
// ----------------------------------------------------
export function SettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [key, setKey] = useState('address');
  const [value, setValue] = useState('');

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('library_settings').select('*').eq('is_public', true).then(({ data }) => {
      setRows(data ?? []);
      const match = (data ?? []).find((r) => r.setting_key === 'address');
      if (match) setValue(match.setting_value || '');
    });
  }, []);

  const handleKeyChange = (newKey: string) => {
    setKey(newKey);
    const match = rows.find((r) => r.setting_key === newKey);
    setValue(match ? match.setting_value || '' : '');
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    await client.from('library_settings').upsert({ setting_key: key, setting_value: value, is_public: true }, { onConflict: 'setting_key' });
    const { data } = await client.from('library_settings').select('*').eq('is_public', true);
    setRows(data ?? []);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title="Centralized Gym Settings">
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.setting_key} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                <div className="font-extrabold text-red-500 text-xs uppercase tracking-wider">{row.setting_key}</div>
                <div className="text-xs text-zinc-300 mt-1 break-words">{row.setting_value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <Card title="Edit Centralized Gym Setting">
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Setting Key</label>
              <select value={key} onChange={(e) => handleKeyChange(e.target.value)} className={inputClassName}>
                <option value="business_name">Gym Name</option>
                <option value="address">Address (Full)</option>
                <option value="address_short">Short Address (Navbar/Footer)</option>
                <option value="location_ref">Location Reference / Landmark</option>
                <option value="hours">Hours / Timings</option>
                <option value="phone_display">Phone Display</option>
                <option value="whatsapp_number">WhatsApp Number</option>
                <option value="directions_url">Google Maps Directions URL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Setting Value</label>
              <textarea
                rows={4}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter setting value..."
                className={inputClassName}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm"
            >
              Save Gym Setting
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
