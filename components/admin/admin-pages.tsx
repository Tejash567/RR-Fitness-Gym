'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
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

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d7ded8',
  background: '#fffefb',
  fontSize: 14,
} as const;

type Row = Record<string, any>;

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#fffefb', border: '1px solid #d7ded8', borderRadius: 14, padding: 20, boxShadow: '0 8px 18px rgba(24,50,45,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, color: '#0f0f11', fontSize: 17, fontWeight: 800 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({ title, value, subtext, icon, color = '#dc2626' }: { title: string; value: string | number; subtext?: string; icon: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 14, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#71717a', fontWeight: 600 }}>{title}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}15`, color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#09090b', letterSpacing: '-0.02em' }}>{value}</div>
      {subtext && <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>{subtext}</div>}
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

      // Calculate Member Metrics
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

      // Calculate Financials for This Month
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

      // Build Attendance Chart Data (Last 7 Days)
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

      // Build Monthly Financial Chart Data (Last 6 Months)
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

      // Distribution Chart Data
      setMemberDistData([
        { name: 'Active', value: activeCount - expiringSoonCount, color: '#10b981' },
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
    return <div style={{ padding: 24, textAlign: 'center', color: '#71717a' }}>Loading gym analytics…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {error && <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, color: '#dc2626' }}>{error}</div>}

      {/* 8 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title="Total Members" value={stats.totalMembers} icon={<Users size={18} />} color="#3b82f6" />
        <StatCard title="Active Members" value={stats.activeMembers} icon={<UserCheck size={18} />} color="#10b981" />
        <StatCard title="Expiring Soon (7d)" value={stats.expiringSoon} icon={<AlertTriangle size={18} />} color="#f59e0b" />
        <StatCard title="Expired Members" value={stats.expiredMembers} icon={<XCircle size={18} />} color="#ef4444" />
        <StatCard title="Today's Attendance" value={stats.todayAttendance} icon={<Activity size={18} />} color="#8b5cf6" />
        <StatCard title="This Month Revenue" value={formatINR(stats.thisMonthRevenue)} icon={<DollarSign size={18} />} color="#10b981" />
        <StatCard title="This Month Expenses" value={formatINR(stats.thisMonthExpenses)} icon={<TrendingDown size={18} />} color="#ef4444" />
        <StatCard title="This Month Profit" value={formatINR(stats.thisMonthProfit)} icon={<TrendingUp size={18} />} color={stats.thisMonthProfit >= 0 ? '#10b981' : '#ef4444'} />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 18 }}>
        <Card title="Monthly Revenue vs Expenses vs Profit">
          {financialChartData.some((d) => d.Revenue > 0 || d.Expenses > 0) ? (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={financialChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip formatter={(val: any) => formatINR(Number(val))} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 200, display: 'grid', placeItems: 'center', color: '#a1a1aa' }}>No financial data available</div>
          )}
        </Card>

        <Card title="Daily Attendance (Last 7 Days)">
          {attendanceChartData.some((d) => d.visits > 0) ? (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={attendanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="visits" stroke="#dc2626" strokeWidth={3} dot={{ r: 5, fill: '#dc2626' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 200, display: 'grid', placeItems: 'center', color: '#a1a1aa' }}>No attendance data available</div>
          )}
        </Card>
      </div>

      {/* Row 2: Distribution & Recent Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 18 }}>
        <Card title="Member Membership Status Distribution">
          {memberDistData.some((d) => d.value > 0) ? (
            <div style={{ width: '100%', height: 240, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={memberDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => `${entry.name}: ${entry.value}`}>
                    {memberDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 200, display: 'grid', placeItems: 'center', color: '#a1a1aa' }}>No member data available</div>
          )}
        </Card>

        <Card title="Recent Payment Transactions">
          {recentPayments.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentPayments.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f4f4f5', paddingBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#09090b', fontSize: 14 }}>
                      {p.members?.full_name || 'Member'} {p.members?.member_code ? `(${p.members.member_code})` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a' }}>{p.payment_date} • {p.payment_method.toUpperCase()}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: 15 }}>{formatINR(Number(p.amount))}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#71717a', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>No payment records yet.</div>
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
    user_id: '',
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
      user_id: form.user_id || null,
    };

    if (form.id) {
      const { error } = await client.from('members').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('member_edited', 'members', form.id, `Updated details for member ${form.full_name}`);
    } else {
      const { error } = await client.from('members').insert(payload);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('member_created', 'members', undefined, `Created member ${form.full_name}`);
    }

    await loadData();
    setForm({
      id: '', member_code: '', full_name: '', phone: '', email: '', gender: '', dob: '', address: '', emergency_contact: '', membership_plan_id: '', start_date: '', expiry_date: '', status: 'active', notes: '', user_id: ''
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
      user_id: member.user_id ?? '',
    });
    setSelectedMember(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleDeactivate = async (member: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    const newStatus = member.status === 'inactive' ? 'active' : 'inactive';
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
    <div style={{ display: 'grid', gap: 20 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* Member List */}
        <Card title={`All Gym Members (${filteredMembers.length})`}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a1a1aa' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member name, phone, or Member ID..."
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>

          <div style={{ display: 'grid', gap: 10, maxHeight: 600, overflowY: 'auto' }}>
            {filteredMembers.map((m) => {
              const statusMeta = getCalculatedStatus(m.expiry_date, m.status);
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #e4e4e7', borderRadius: 10, background: '#ffffff' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 15, color: '#09090b' }}>{m.full_name}</strong>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f4f4f5', color: '#52525b', fontWeight: 700 }}>
                        {m.member_code || 'No ID'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                      Phone: {m.phone} • Plan: {m.membership_plans?.name || 'Unassigned'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, fontWeight: 800, color: statusMeta.color, background: `${statusMeta.color}15` }}>
                      {statusMeta.label}
                    </span>
                    <button type="button" onClick={() => openProfileModal(m)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d4d4d8', background: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={14} /> Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Add/Edit Member Form */}
        <Card title={form.id ? 'Edit Member Profile' : 'Add New Gym Member'}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Member Code ID</label>
                <input value={form.member_code} onChange={(e) => setForm({ ...form, member_code: e.target.value })} placeholder="Auto: RR-F-0001" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Full Name *</label>
                <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full Name" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Phone Number *</label>
                <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone Number" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Email Address</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email Address" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} style={inputStyle}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Date of Birth</label>
                <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Residential Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address in Roorkee/Jhabrera" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Emergency Contact</label>
                <input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Phone / Person" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Assign Plan</label>
                <select value={form.membership_plan_id} onChange={(e) => setForm({ ...form, membership_plan_id: e.target.value })} style={inputStyle}>
                  <option value="">Select Plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Membership Start Date</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Membership Expiry Date</label>
                <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Link Supabase Auth User ID (for Member Portal)</label>
              <input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="UUID from auth.users (optional)" style={inputStyle} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Notes / Remarks</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes about health goals, injuries, etc." rows={2} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                {form.id ? 'Update Member Profile' : 'Save Member'}
              </button>
              {form.id && (
                <button type="button" onClick={() => setForm({ id: '', member_code: '', full_name: '', phone: '', email: '', gender: '', dob: '', address: '', emergency_contact: '', membership_plan_id: '', start_date: '', expiry_date: '', status: 'active', notes: '', user_id: '' })} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #d4d4d8', background: '#f4f4f5', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Card>
      </div>

      {/* Complete Member Profile Modal */}
      {selectedMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ maxWidth: 850, width: '100%', maxHeight: '90vh', background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 16, overflowY: 'auto', padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MEMBER PROFILE DETAIL</div>
                <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: '#09090b' }}>
                  {selectedMember.full_name} <span style={{ fontSize: 14, color: '#71717a', fontWeight: 600 }}>({selectedMember.member_code || 'No Code'})</span>
                </h2>
              </div>
              <button onClick={() => setSelectedMember(null)} style={{ border: 0, background: '#f4f4f5', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 12, border: '1px solid #e4e4e7' }}>
                <h4 style={{ margin: '0 0 10px', color: '#09090b' }}>Personal Profile</h4>
                <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#3f3f46' }}>
                  <div><strong>Phone:</strong> {selectedMember.phone}</div>
                  <div><strong>Email:</strong> {selectedMember.email || '—'}</div>
                  <div><strong>Gender:</strong> {selectedMember.gender || '—'}</div>
                  <div><strong>DOB:</strong> {selectedMember.dob || '—'}</div>
                  <div><strong>Address:</strong> {selectedMember.address || '—'}</div>
                  <div><strong>Emergency Contact:</strong> {selectedMember.emergency_contact || '—'}</div>
                  <div><strong>Joined Date:</strong> {selectedMember.created_at?.slice(0, 10) || '—'}</div>
                  <div><strong>Auth User Linked:</strong> {selectedMember.user_id ? 'Yes (Portal Active)' : 'No'}</div>
                </div>
              </div>

              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 12, border: '1px solid #e4e4e7' }}>
                <h4 style={{ margin: '0 0 10px', color: '#09090b' }}>Current Membership Status</h4>
                {(() => {
                  const statusMeta = getCalculatedStatus(selectedMember.expiry_date, selectedMember.status);
                  return (
                    <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#3f3f46' }}>
                      <div><strong>Current Plan:</strong> {selectedMember.membership_plans?.name || 'Unassigned'}</div>
                      <div><strong>Start Date:</strong> {selectedMember.start_date || '—'}</div>
                      <div><strong>Expiry Date:</strong> {selectedMember.expiry_date || '—'}</div>
                      <div>
                        <strong>Calculated Status:</strong>{' '}
                        <span style={{ color: statusMeta.color, fontWeight: 800 }}>{statusMeta.label}</span>
                      </div>
                      {typeof statusMeta.diffDays === 'number' && (
                        <div><strong>Days Remaining:</strong> {statusMeta.diffDays < 0 ? `Expired ${Math.abs(statusMeta.diffDays)} days ago` : `${statusMeta.diffDays} days`}</div>
                      )}
                      <div><strong>Notes:</strong> {selectedMember.notes || 'None'}</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Sub-tabs: Payments & Attendance */}
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <h4 style={{ margin: '0 0 10px', color: '#09090b' }}>Payment History ({memberPayments.length})</h4>
                {memberPayments.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f4f4f5', textAlign: 'left' }}>
                        <th style={{ padding: 8, border: '1px solid #e4e4e7' }}>Date</th>
                        <th style={{ padding: 8, border: '1px solid #e4e4e7' }}>Amount</th>
                        <th style={{ padding: 8, border: '1px solid #e4e4e7' }}>Method</th>
                        <th style={{ padding: 8, border: '1px solid #e4e4e7' }}>Plan / Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberPayments.map((p) => (
                        <tr key={p.id}>
                          <td style={{ padding: 8, border: '1px solid #e4e4e7' }}>{p.payment_date}</td>
                          <td style={{ padding: 8, border: '1px solid #e4e4e7', fontWeight: 700, color: '#10b981' }}>{formatINR(Number(p.amount))}</td>
                          <td style={{ padding: 8, border: '1px solid #e4e4e7' }}>{p.payment_method.toUpperCase()}</td>
                          <td style={{ padding: 8, border: '1px solid #e4e4e7' }}>{p.membership_plans?.name || p.reference || 'General payment'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 13, color: '#71717a' }}>No payment records found for this member.</div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px', color: '#09090b' }}>Attendance Log ({memberAttendance.length} visits)</h4>
                {memberAttendance.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {memberAttendance.slice(0, 20).map((a) => (
                      <div key={a.id} style={{ padding: '8px 10px', border: '1px solid #e4e4e7', borderRadius: 8, background: '#ffffff', fontSize: 12 }}>
                        <strong>{a.attendance_date}</strong>
                        <div style={{ color: '#71717a' }}>In: {a.entry_time || '—'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#71717a' }}>No attendance logged for this member yet.</div>
                )}
              </div>
            </div>

            {/* Modal Quick Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e4e4e7' }}>
              <button type="button" onClick={() => handleEdit(selectedMember)} style={{ padding: '10px 16px', background: '#dc2626', color: 'white', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                Edit Details
              </button>
              <button type="button" onClick={() => handleToggleDeactivate(selectedMember)} style={{ padding: '10px 16px', background: selectedMember.status === 'inactive' ? '#10b981' : '#ef4444', color: 'white', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {selectedMember.status === 'inactive' ? 'Reactivate Member' : 'Deactivate Member'}
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
      if (!window.confirm('WARNING: Editing an existing payment record may alter member membership dates. Proceed?')) return;
      const { error } = await client.from('payments').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('payment_edited', 'payments', form.id, `Updated payment of ${form.amount}`);
    } else {
      const { error } = await client.from('payments').insert(payload);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('payment_created', 'payments', undefined, `Recorded payment of ${form.amount} for member ID ${form.member_id}`);

      // Auto-update member's expiry date and plan if specified
      if (form.membership_end_date || form.membership_plan_id) {
        await client.from('members').update({
          membership_plan_id: form.membership_plan_id || undefined,
          start_date: form.membership_start_date || undefined,
          expiry_date: form.membership_end_date || undefined,
          status: 'active',
        }).eq('id', form.member_id);
      }
    }

    await loadData();
    setForm({ id: '', member_id: '', membership_plan_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'cash', membership_start_date: new Date().toISOString().slice(0, 10), membership_end_date: '', reference: '', notes: '' });
    setMessage('Payment saved successfully.');
  };

  const handleEdit = (p: Row) => {
    setForm({
      id: p.id,
      member_id: p.member_id ?? '',
      membership_plan_id: p.membership_plan_id ?? '',
      amount: String(p.amount ?? ''),
      payment_date: p.payment_date ?? '',
      payment_method: p.payment_method ?? 'cash',
      membership_start_date: p.membership_start_date ?? '',
      membership_end_date: p.membership_end_date ?? '',
      reference: p.reference ?? '',
      notes: p.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (p: Row) => {
    if (!window.confirm('WARNING: Deleting a payment record cannot be undone. Proceed with caution.')) return;
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('payments').delete().eq('id', p.id);
    if (!error) {
      await writeAuditLog('payment_deleted', 'payments', p.id, `Deleted payment record of ₹${p.amount}`);
      await loadData();
      setMessage('Payment deleted.');
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch = `${p.members?.full_name ?? ''} ${p.members?.member_code ?? ''} ${p.reference ?? ''}`.toLowerCase().includes(search.toLowerCase());
      const matchMethod = !methodFilter || p.payment_method === methodFilter;
      return matchSearch && matchMethod;
    });
  }, [payments, search, methodFilter]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* Payments List */}
        <Card title={`Payment Transactions (${filteredPayments.length})`}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a1a1aa' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter member name or reference..." style={{ ...inputStyle, paddingLeft: 36 }} />
            </div>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} style={{ ...inputStyle, width: 140 }}>
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: 10, maxHeight: 600, overflowY: 'auto' }}>
            {filteredPayments.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #e4e4e7', borderRadius: 10, background: '#ffffff' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 15, color: '#09090b' }}>{p.members?.full_name || 'Member'}</strong>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f4f4f5', color: '#52525b', fontWeight: 700 }}>
                      {p.members?.member_code || 'ID'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                    {p.payment_date} • Method: <strong>{p.payment_method.toUpperCase()}</strong> {p.reference ? `(${p.reference})` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>{formatINR(Number(p.amount))}</div>
                  <button onClick={() => handleEdit(p)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d4d4d8', background: '#ffffff', cursor: 'pointer' }}><Edit size={14} /></button>
                  <button onClick={() => handleDelete(p)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Record Payment Form */}
        <Card title={form.id ? 'Edit Payment Record' : 'Record Member Payment'}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Select Member *</label>
              <select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} style={inputStyle}>
                <option value="">Choose Member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_code || 'No Code'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Membership Plan (Optional)</label>
              <select value={form.membership_plan_id} onChange={(e) => handlePlanSelect(e.target.value)} style={inputStyle}>
                <option value="">Select Plan (Autofills Amount & End Date)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} - {p.price}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Amount (₹) *</label>
                <input required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1500" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Payment Date *</label>
                <input type="date" required value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Payment Method *</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} style={inputStyle}>
                <option value="cash">Cash</option>
                <option value="upi">UPI / GPay / PhonePe</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Membership Start Date</label>
                <input type="date" value={form.membership_start_date} onChange={(e) => setForm({ ...form, membership_start_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Membership Expiry Date</label>
                <input type="date" value={form.membership_end_date} onChange={(e) => setForm({ ...form, membership_end_date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Transaction Ref / UPI ID</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="UPI reference or receipt no" style={inputStyle} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional payment notes" style={inputStyle} />
            </div>

            <button type="submit" style={{ padding: '12px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', fontWeight: 800, cursor: 'pointer', marginTop: 6 }}>
              {form.id ? 'Update Payment' : 'Save Payment'}
            </button>
          </form>
        </Card>
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
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    member_id: '',
    attendance_date: new Date().toISOString().slice(0, 10),
    entry_time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    exit_time: '',
    source: 'manual',
    device_user_id: '',
  });

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const [{ data: attData }, { data: membersData }] = await Promise.all([
      client.from('attendance').select('*, members(full_name, member_code)').order('attendance_date', { ascending: false }).limit(50),
      client.from('members').select('id, full_name, member_code, status').eq('status', 'active').order('created_at', { ascending: false }),
    ]);
    setAttendance(attData ?? []);
    setMembers(membersData ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    if (!form.member_id) {
      setMessage('Please select a member.');
      return;
    }

    const payload = {
      member_id: form.member_id,
      attendance_date: form.attendance_date || new Date().toISOString().slice(0, 10),
      entry_time: form.entry_time || null,
      exit_time: form.exit_time || null,
      source: form.source || 'manual',
      device_user_id: form.device_user_id || null,
    };

    const { error } = await client.from('attendance').insert(payload);
    if (error) { setMessage(error.message); return; }

    await loadData();
    setForm({ member_id: '', attendance_date: new Date().toISOString().slice(0, 10), entry_time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), exit_time: '', source: 'manual', device_user_id: '' });
    setMessage('Attendance check-in logged.');
  };

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      const matchSearch = `${a.members?.full_name ?? ''} ${a.members?.member_code ?? ''}`.toLowerCase().includes(search.toLowerCase());
      const matchDate = !filterDate || a.attendance_date === filterDate;
      return matchSearch && matchDate;
    });
  }, [attendance, search, filterDate]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        <Card title={`Attendance Logs (${filteredAttendance.length})`}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a1a1aa' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member name or Member ID..." style={{ ...inputStyle, paddingLeft: 36 }} />
            </div>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </div>

          <div style={{ display: 'grid', gap: 10, maxHeight: 550, overflowY: 'auto' }}>
            {filteredAttendance.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #e4e4e7', borderRadius: 10, background: '#ffffff' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 15, color: '#09090b' }}>{a.members?.full_name || 'Member'}</strong>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f4f4f5', color: '#52525b', fontWeight: 700 }}>
                      {a.members?.member_code || 'ID'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                    Date: <strong>{a.attendance_date}</strong> • Entry Source: <strong>{a.source || 'manual'}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: 13, color: '#09090b', fontWeight: 600 }}>
                  <div>In: {a.entry_time || '—'}</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>Out: {a.exit_time || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Record Attendance Form */}
        <Card title="Check-In Member Attendance">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Select Active Member *</label>
              <select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} style={inputStyle}>
                <option value="">Select Member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name} ({m.member_code || 'No ID'})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Attendance Date *</label>
              <input type="date" required value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Check-In Time</label>
                <input type="time" value={form.entry_time} onChange={(e) => setForm({ ...form, entry_time: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Check-Out Time</label>
                <input type="time" value={form.exit_time} onChange={(e) => setForm({ ...form, exit_time: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Entry Source</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={inputStyle}>
                <option value="manual">Manual Check-In</option>
                <option value="essl_x990">eSSL X990 Biometric Device</option>
              </select>
            </div>

            <button type="submit" style={{ padding: '12px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', fontWeight: 800, cursor: 'pointer', marginTop: 6 }}>
              Log Attendance
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. EXPENSES PAGE
// ----------------------------------------------------
export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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

  const categories = ['Electricity', 'Rent', 'Equipment', 'Maintenance', 'Staff', 'Cleaning', 'Marketing', 'Other'];

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
      const { error } = await client.from('expenses').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('expense_edited', 'expenses', form.id, `Updated expense ${form.title}`);
    } else {
      const { error } = await client.from('expenses').insert(payload);
      if (error) { setMessage(error.message); return; }
      await writeAuditLog('expense_created', 'expenses', undefined, `Created expense ${form.title} of ₹${form.amount}`);
    }

    await loadData();
    setForm({ id: '', title: '', category: 'Electricity', amount: '', expense_date: new Date().toISOString().slice(0, 10), payment_method: 'cash', notes: '' });
    setMessage('Expense saved.');
  };

  const handleEdit = (ex: Row) => {
    setForm({
      id: ex.id,
      title: ex.title ?? '',
      category: ex.category ?? 'Electricity',
      amount: String(ex.amount ?? ''),
      expense_date: ex.expense_date ?? '',
      payment_method: ex.payment_method ?? 'cash',
      notes: ex.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (ex: Row) => {
    if (!window.confirm(`Delete expense "${ex.title}"?`)) return;
    const client = createBrowserClient();
    if (!client) return;

    const { error } = await client.from('expenses').delete().eq('id', ex.id);
    if (!error) {
      await writeAuditLog('expense_deleted', 'expenses', ex.id, `Deleted expense "${ex.title}"`);
      await loadData();
      setMessage('Expense record deleted.');
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((ex) => {
      const matchSearch = (ex.title ?? '').toLowerCase().includes(search.toLowerCase());
      const matchCat = !categoryFilter || ex.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [expenses, search, categoryFilter]);

  const totalExpenseSum = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        <Card title={`Gym Expenses (${filteredExpenses.length})`} action={<span style={{ fontWeight: 800, color: '#ef4444' }}>Total: {formatINR(totalExpenseSum)}</span>}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#a1a1aa' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter expense title..." style={{ ...inputStyle, paddingLeft: 36 }} />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: 150 }}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 10, maxHeight: 550, overflowY: 'auto' }}>
            {filteredExpenses.map((ex) => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #e4e4e7', borderRadius: 10, background: '#ffffff' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#09090b' }}>{ex.title}</div>
                  <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                    {ex.expense_date} • Category: <strong>{ex.category}</strong> • Paid via {ex.payment_method.toUpperCase()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 900, color: '#ef4444', fontSize: 15 }}>{formatINR(Number(ex.amount))}</div>
                  <button onClick={() => handleEdit(ex)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d4d4d8', background: '#ffffff', cursor: 'pointer' }}><Edit size={14} /></button>
                  <button onClick={() => handleDelete(ex)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Record Expense Form */}
        <Card title={form.id ? 'Edit Gym Expense' : 'Add Gym Expense'}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Expense Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. July Electricity Bill" style={inputStyle} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Expense Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Amount (₹) *</label>
                <input required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="2500" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Expense Date *</label>
                <input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} style={inputStyle}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3f3f46' }}>Notes / Vendor Details</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Vendor name, invoice number, etc." style={inputStyle} />
            </div>

            <button type="submit" style={{ padding: '12px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', fontWeight: 800, cursor: 'pointer', marginTop: 6 }}>
              {form.id ? 'Update Expense' : 'Save Expense'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. REPORTS & CSV EXPORT PAGE
// ----------------------------------------------------
export function ReportsPage() {
  const [reportType, setReportType] = useState<'members' | 'payments' | 'expenses' | 'pnl' | 'attendance'>('pnl');
  const [members, setMembers] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;

    const loadAll = async () => {
      const [
        { data: m },
        { data: p },
        { data: e },
        { data: a },
      ] = await Promise.all([
        client.from('members').select('*, membership_plans(name)'),
        client.from('payments').select('*, members(full_name, member_code)'),
        client.from('expenses').select('*'),
        client.from('attendance').select('*, members(full_name, member_code)'),
      ]);
      setMembers(m ?? []);
      setPayments(p ?? []);
      setExpenses(e ?? []);
      setAttendance(a ?? []);
      setLoading(false);
    };

    loadAll();
  }, []);

  const totalRevenue = useMemo(() => payments.reduce((acc, item) => acc + Number(item.amount || 0), 0), [payments]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0), [expenses]);
  const netProfit = totalRevenue - totalExpenses;

  const exportCSV = () => {
    let rows: string[][] = [];
    let filename = `rr-fitness-${reportType}-report.csv`;

    if (reportType === 'members') {
      rows.push(['Member Code', 'Full Name', 'Phone', 'Status', 'Start Date', 'Expiry Date']);
      members.forEach((m) => {
        rows.push([m.member_code || '', m.full_name || '', m.phone || '', m.status || '', m.start_date || '', m.expiry_date || '']);
      });
    } else if (reportType === 'payments') {
      rows.push(['Date', 'Member Code', 'Member Name', 'Amount (INR)', 'Method', 'Reference']);
      payments.forEach((p) => {
        rows.push([p.payment_date || '', p.members?.member_code || '', p.members?.full_name || '', String(p.amount || 0), p.payment_method || '', p.reference || '']);
      });
    } else if (reportType === 'expenses') {
      rows.push(['Date', 'Title', 'Category', 'Amount (INR)', 'Method']);
      expenses.forEach((ex) => {
        rows.push([ex.expense_date || '', ex.title || '', ex.category || '', String(ex.amount || 0), ex.payment_method || '']);
      });
    } else if (reportType === 'pnl') {
      rows.push(['Metric', 'Amount (INR)']);
      rows.push(['Total Revenue', String(totalRevenue)]);
      rows.push(['Total Expenses', String(totalExpenses)]);
      rows.push(['Net Profit', String(netProfit)]);
    } else if (reportType === 'attendance') {
      rows.push(['Date', 'Member Code', 'Member Name', 'Entry Time', 'Source']);
      attendance.forEach((a) => {
        rows.push([a.attendance_date || '', a.members?.member_code || '', a.members?.full_name || '', a.entry_time || '', a.source || 'manual']);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((cell) => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#71717a' }}>Generating reports…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card
        title="Gym Management Reports & Auditing"
        action={
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#dc2626', color: 'white', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            <Download size={15} /> Export CSV
          </button>
        }
      >
        {/* Report Selector Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={() => setReportType('pnl')} style={{ padding: '8px 14px', borderRadius: 8, border: reportType === 'pnl' ? '2px solid #dc2626' : '1px solid #d4d4d8', background: reportType === 'pnl' ? '#dc262610' : '#fff', fontWeight: 700, cursor: 'pointer' }}>Profit & Loss</button>
          <button onClick={() => setReportType('members')} style={{ padding: '8px 14px', borderRadius: 8, border: reportType === 'members' ? '2px solid #dc2626' : '1px solid #d4d4d8', background: reportType === 'members' ? '#dc262610' : '#fff', fontWeight: 700, cursor: 'pointer' }}>Members Report</button>
          <button onClick={() => setReportType('payments')} style={{ padding: '8px 14px', borderRadius: 8, border: reportType === 'payments' ? '2px solid #dc2626' : '1px solid #d4d4d8', background: reportType === 'payments' ? '#dc262610' : '#fff', fontWeight: 700, cursor: 'pointer' }}>Payments Report</button>
          <button onClick={() => setReportType('expenses')} style={{ padding: '8px 14px', borderRadius: 8, border: reportType === 'expenses' ? '2px solid #dc2626' : '1px solid #d4d4d8', background: reportType === 'expenses' ? '#dc262610' : '#fff', fontWeight: 700, cursor: 'pointer' }}>Expenses Report</button>
          <button onClick={() => setReportType('attendance')} style={{ padding: '8px 14px', borderRadius: 8, border: reportType === 'attendance' ? '2px solid #dc2626' : '1px solid #d4d4d8', background: reportType === 'attendance' ? '#dc262610' : '#fff', fontWeight: 700, cursor: 'pointer' }}>Attendance Log</button>
        </div>

        {reportType === 'pnl' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: '#047857', fontWeight: 700 }}>Total Revenue</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#047857', marginTop: 4 }}>{formatINR(totalRevenue)}</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700 }}>Total Expenses</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>{formatINR(totalExpenses)}</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 700 }}>Net Gym Profit</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: netProfit >= 0 ? '#1d4ed8' : '#dc2626', marginTop: 4 }}>{formatINR(netProfit)}</div>
              </div>
            </div>
          </div>
        )}

        {reportType === 'members' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f4f4f5', textAlign: 'left' }}>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Member Code</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Full Name</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Phone</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Status</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7', fontWeight: 700 }}>{m.member_code || '—'}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{m.full_name}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{m.phone}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{m.status}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{m.expiry_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'payments' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f4f4f5', textAlign: 'left' }}>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Date</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Member</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Amount</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Method</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{p.payment_date}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{p.members?.full_name} ({p.members?.member_code})</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7', fontWeight: 700, color: '#10b981' }}>{formatINR(Number(p.amount))}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{p.payment_method.toUpperCase()}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'expenses' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f4f4f5', textAlign: 'left' }}>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Date</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Title</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Category</th>
                <th style={{ padding: 10, border: '1px solid #e4e4e7' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((ex) => (
                <tr key={ex.id}>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{ex.expense_date}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7', fontWeight: 700 }}>{ex.title}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7' }}>{ex.category}</td>
                  <td style={{ padding: 10, border: '1px solid #e4e4e7', fontWeight: 700, color: '#ef4444' }}>{formatINR(Number(ex.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// Existing unchanged admin helpers: PlansPage, AnnouncementsPage, ContentPage, GalleryPage, SocialPage, SettingsPage
export function PlansPage() {
  const [plans, setPlans] = useState<Row[]>([]);
  const [form, setForm] = useState({ id: '', name: '', description: '', price: '', duration_days: '', features: '', is_active: true });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('membership_plans').select('*').order('display_order', { ascending: true }).then(({ data }) => setPlans(data ?? []));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    const payload = { name: form.name, description: form.description, price: form.price, duration_days: Number(form.duration_days), features: form.features.split(',').map(f => f.trim()).filter(f => f), is_active: form.is_active, display_order: form.id ? plans.find(p => p.id === form.id)?.display_order ?? plans.length + 1 : plans.length + 1 };
    if (form.id) {
      const { error } = await client.from('membership_plans').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
    } else {
      const { error } = await client.from('membership_plans').insert(payload);
      if (error) { setMessage(error.message); return; }
    }
    const { data } = await client.from('membership_plans').select('*').order('display_order', { ascending: true });
    setPlans(data ?? []);
    setForm({ id: '', name: '', description: '', price: '', duration_days: '', features: '', is_active: true });
    setMessage('Plan saved.');
  };

  const handleEdit = (plan: Row) => {
    setForm({
      id: plan.id,
      name: plan.name ?? '',
      description: plan.description ?? '',
      price: plan.price ?? '',
      duration_days: String(plan.duration_days ?? ''),
      features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
      is_active: plan.is_active ?? true,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (plan: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    const { data: membersData } = await client.from('members').select('id').eq('membership_plan_id', plan.id);
    if (membersData && membersData.length > 0) {
      setMessage('Cannot delete: This plan is assigned to existing members. Consider deactivating it instead.');
      return;
    }
    if (!window.confirm('Delete this membership plan?')) return;
    const { error } = await client.from('membership_plans').delete().eq('id', plan.id);
    if (error) { setMessage(error.message); return; }
    setPlans((current) => current.filter((p) => p.id !== plan.id));
    setMessage('Plan deleted.');
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Membership Plans">
          <div style={{ display: 'grid', gap: 10 }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{plan.name} • {plan.price}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>{plan.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleEdit(plan)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(plan)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d8784c', color: '#d8784c', background: '#fffefb', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Create or Edit Plan">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Plan name" style={inputStyle} />
            <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} style={inputStyle} />
            <input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" style={inputStyle} />
            <input required value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} placeholder="Duration (days)" style={inputStyle} />
            <input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Comma separated features" style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} type="checkbox" /> Active
            </label>
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>{form.id ? 'Update Plan' : 'Save Plan'}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Row[]>([]);
  const [form, setForm] = useState({ id: '', title: '', content: '', is_active: true, start_at: '', expires_at: '' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('announcements').select('*').order('created_at', { ascending: false }).then(({ data }) => setAnnouncements(data ?? []));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    const payload = { title: form.title, content: form.content, is_active: form.is_active, start_at: form.start_at || null, expires_at: form.expires_at || null };
    if (form.id) {
      const { error } = await client.from('announcements').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
    } else {
      const { error } = await client.from('announcements').insert(payload);
      if (error) { setMessage(error.message); return; }
    }
    const { data } = await client.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data ?? []);
    setForm({ id: '', title: '', content: '', is_active: true, start_at: '', expires_at: '' });
    setMessage('Announcement saved.');
  };

  const handleEdit = (item: Row) => {
    setForm({
      id: item.id, title: item.title ?? '', content: item.content ?? '', is_active: item.is_active ?? true, start_at: item.start_at ?? '', expires_at: item.expires_at ?? ''
    });
  };

  const handleDelete = async (item: Row) => {
    if (!window.confirm('Delete announcement?')) return;
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('announcements').delete().eq('id', item.id);
    if (!error) {
      setAnnouncements((current) => current.filter((a) => a.id !== item.id));
      setMessage('Announcement deleted.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Announcements">
          <div style={{ display: 'grid', gap: 10 }}>
            {announcements.map((item) => (
              <div key={item.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>{item.content}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleEdit(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d8784c', color: '#d8784c', background: '#fffefb', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Create or Edit Announcement">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={inputStyle} />
            <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content" rows={4} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} type="checkbox" /> Active
            </label>
            <input value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} type="date" style={inputStyle} />
            <input value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} type="date" style={inputStyle} />
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>{form.id ? 'Update Announcement' : 'Save Announcement'}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function ContentPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedKey, setSelectedKey] = useState('hero_heading');
  const [value, setValue] = useState('');
  const defaults = [
    ['hero_heading', 'RR FITNESS'],
    ['hero_description', 'Train Hard. Stay Strong. A modern fitness destination in Jhabrera.'],
    ['about_heading', 'Train Hard. Stay Strong.'],
    ['about_description', 'RR Fitness is a modern gym in Jhabrera, Uttarakhand offering quality fitness equipment and dumbbell area for your workout.'],
    ['contact_heading', 'Visit RR Fitness.'],
    ['contact_description', 'Find us at 5, Roorkee, Jhabrera, Uttarakhand 247665 (Near Ambika Battery). Open daily until 10 PM.'],
  ];

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('website_content').select('*').eq('is_active', true).then(({ data }) => setRows(data ?? []));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    await client.from('website_content').upsert({ page: 'home', content_key: selectedKey, content_value: value, content_type: 'text', is_active: true });
    const { data } = await client.from('website_content').select('*').eq('is_active', true);
    setRows(data ?? []);
  };

  return (
    <Card title="Editable Website Content">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <select value={selectedKey} onChange={(e) => { setSelectedKey(e.target.value); const current = rows.find((r) => r.content_key === e.target.value); setValue(current?.content_value ?? ''); }} style={inputStyle}>
          {defaults.map(([key]) => <option key={key} value={key}>{key}</option>)}
        </select>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} style={inputStyle} />
        <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Save Content</button>
      </form>
    </Card>
  );
}

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

    let storagePath = form.storage_path;
    let publicUrl = form.public_url;

    if (file) {
      const path = `gallery/${Date.now()}-${file.name}`;
      const { error: uploadError } = await client.storage.from('library-gallery').upload(path, file, { upsert: true });
      if (uploadError) { setMessage(`Upload failed: ${uploadError.message}`); return; }
      const { data: publicData } = client.storage.from('library-gallery').getPublicUrl(path);
      storagePath = path;
      publicUrl = publicData.publicUrl;
    }

    const payload = {
      title: form.title, category: form.category, alt_text: form.alt_text, storage_path: storagePath, public_url: publicUrl, is_published: form.is_published,
      display_order: form.id ? items.find(i => i.id === form.id)?.display_order ?? items.length + 1 : items.length + 1
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
    setMessage('Gallery item saved.');
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Gallery Images">
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div style={{ color: '#687671', fontSize: 13 }}>{item.category}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Upload Gallery Photo">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={inputStyle} />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" style={inputStyle} />
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={inputStyle} />
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Upload Image</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

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
  };

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
      <Card title="Social Links">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.platform} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{row.platform}</div>
              <div style={{ color: '#687671', fontSize: 13 }}>{row.url}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Update Social Link">
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
            <option value="instagram">RR Fitness Instagram</option>
            <option value="owner_instagram">Owner Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="whatsapp">WhatsApp Number</option>
          </select>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL or Number" style={inputStyle} />
          <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Save Link</button>
        </form>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [key, setKey] = useState('address');
  const [value, setValue] = useState('');

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    client.from('library_settings').select('*').eq('is_public', true).then(({ data }) => setRows(data ?? []));
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    await client.from('library_settings').upsert({ setting_key: key, setting_value: value, is_public: true });
    const { data } = await client.from('library_settings').select('*').eq('is_public', true);
    setRows(data ?? []);
  };

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
      <Card title="Centralized Gym Settings">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.setting_key} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{row.setting_key}</div>
              <div style={{ color: '#687671', fontSize: 13 }}>{row.setting_value}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Edit Centralized Setting">
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
          <select value={key} onChange={(e) => setKey(e.target.value)} style={inputStyle}>
            <option value="business_name">Gym Name</option>
            <option value="address">Address</option>
            <option value="location_ref">Location Reference</option>
            <option value="hours">Hours / Timings</option>
            <option value="phone_display">Phone Display</option>
            <option value="whatsapp_number">WhatsApp Number</option>
            <option value="directions_url">Google Maps Directions URL</option>
          </select>
          <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} style={inputStyle} />
          <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Save Setting</button>
        </form>
      </Card>
    </div>
  );
}
