'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
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
  Globe,
  Image as ImageIcon,
  Instagram,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Sliders,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  UserCheck,
  UserPlus,
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
import {
  calculateEffectiveExpiry,
  calculateMembershipStatus,
  calculateRenewalDates,
  canMemberEnter,
  cleanIndianPhoneNumber,
  formatDateDisplay,
  formatDateISO,
  formatWhatsAppReminderUrl,
  parseLocalDate,
} from '@/lib/membership';

const inputClassName =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors placeholder:text-slate-400';

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
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm ${className || ''}`}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <h3 className="m-0 text-slate-900 text-base sm:text-lg font-bold tracking-tight">{title}</h3>
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
    <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 truncate pr-1">{title}</span>
        <div
          className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">{value}</div>
      {subtext && <div className="text-[11px] text-slate-500 mt-1 truncate">{subtext}</div>}
    </div>
  );
}

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
    // Non-blocking audit log catch
  }
}

function formatINR(num: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
}

function InitialsAvatar({ name, className = 'w-10 h-10 text-sm' }: { name?: string; className?: string }) {
  const initials = useMemo(() => {
    if (!name) return 'M';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [name]);

  return (
    <div
      className={`rounded-full bg-red-100 text-red-700 font-extrabold flex items-center justify-center shrink-0 border border-red-200 ${className}`}
    >
      {initials}
    </div>
  );
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

  const [expiringMembersList, setExpiringMembersList] = useState<Row[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [financialChartData, setFinancialChartData] = useState<any[]>([]);
  const [memberDistData, setMemberDistData] = useState<any[]>([]);

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
        { data: membersData, error: memErr },
        { data: adjustmentsData },
        { data: paymentsData, error: payErr },
        { data: expensesData },
        { data: attendanceData },
      ] = await Promise.all([
        client.from('members').select('*, membership_plans(name, price)'),
        client.from('membership_adjustments').select('*'),
        client.from('payments').select('id, amount, payment_date, payment_method, member_id, members(full_name, member_code)').order('payment_date', { ascending: false }),
        client.from('expenses').select('id, amount, expense_date'),
        client.from('attendance').select('id, attendance_date, member_id'),
      ]);

      if (memErr) throw new Error(`Members query failed: ${memErr.message}`);
      if (payErr) throw new Error(`Payments query failed: ${payErr.message}`);

      const allMembers = membersData ?? [];
      const allAdjustments = adjustmentsData ?? [];
      const allPayments = paymentsData ?? [];
      const allExpenses = expensesData ?? [];
      const allAttendance = attendanceData ?? [];

      let activeCount = 0;
      let expiringSoonCount = 0;
      let expiredCount = 0;
      const expiringList: Row[] = [];

      allMembers.forEach((m) => {
        const memberAdjustments = allAdjustments.filter((adj) => adj.member_id === m.id);
        const statusRes = calculateMembershipStatus(m, memberAdjustments);

        if (statusRes.status === 'ACTIVE') activeCount++;
        else if (statusRes.status === 'EXPIRING_SOON') {
          activeCount++;
          expiringSoonCount++;
          expiringList.push({ ...m, statusRes });
        } else if (statusRes.status === 'EXPIRED') {
          expiredCount++;
          expiringList.push({ ...m, statusRes });
        }
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
        thisMonthRevenue,
        thisMonthExpenses: thisMonthExpensesSum,
        thisMonthProfit: thisMonthRevenue - thisMonthExpensesSum,
      });

      setExpiringMembersList(expiringList.slice(0, 6));

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });

      const attChart = last7Days.map((dateStr) => {
        const count = allAttendance.filter((a) => a.attendance_date === dateStr).length;
        const dayLabel = parseLocalDate(dateStr)?.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) || dateStr;
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
        const monthLabel = parseLocalDate(`${mStr}-01`)?.toLocaleDateString('en-US', { month: 'short' }) || mStr;
        return { month: monthLabel, Revenue: rev, Expenses: exp, Profit: rev - exp };
      });
      setFinancialChartData(finChart);

      setMemberDistData([
        { name: 'Active', value: Math.max(0, activeCount - expiringSoonCount), color: '#16a34a' },
        { name: 'Expiring Soon', value: expiringSoonCount, color: '#d97706' },
        { name: 'Expired', value: expiredCount, color: '#dc2626' },
      ]);

      setLoading(false);
    };

    loadDashboard().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-500 text-sm">Loading gym analytics…</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* 8 STAT CARDS: MOBILE 2 PER ROW, DESKTOP 4 PER ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Members" value={stats.totalMembers} icon={<Users size={18} />} color="#2563eb" />
        <StatCard title="Active Members" value={stats.activeMembers} icon={<UserCheck size={18} />} color="#16a34a" />
        <StatCard title="Expiring Soon" value={stats.expiringSoon} icon={<AlertTriangle size={18} />} color="#d97706" />
        <StatCard title="Expired Members" value={stats.expiredMembers} icon={<XCircle size={18} />} color="#dc2626" />
        <StatCard title="Today's Attendance" value={stats.todayAttendance} icon={<Activity size={18} />} color="#7c3aed" />
        <StatCard title="Monthly Revenue" value={formatINR(stats.thisMonthRevenue)} icon={<DollarSign size={18} />} color="#16a34a" />
        <StatCard title="Monthly Expenses" value={formatINR(stats.thisMonthExpenses)} icon={<TrendingDown size={18} />} color="#dc2626" />
        <StatCard title="Monthly Profit" value={formatINR(stats.thisMonthProfit)} icon={<TrendingUp size={18} />} color={stats.thisMonthProfit >= 0 ? '#16a34a' : '#dc2626'} />
      </div>

      {/* RENEWAL ACTION LIST & MEMBER DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <Card title="Membership Renewal Reminders">
            {expiringMembersList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No members currently expiring or expired.
              </div>
            ) : (
              <div className="space-y-2.5">
                {expiringMembersList.map((m) => {
                  const planName = m.membership_plans?.name || 'Gym Membership';
                  const waUrl = formatWhatsAppReminderUrl(m, planName, m.statusRes?.effectiveExpiryStr);

                  return (
                    <div
                      key={m.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.full_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <InitialsAvatar name={m.full_name} />
                        )}
                        <div>
                          <div className="text-sm font-bold text-slate-900">{m.full_name}</div>
                          <div className="text-xs text-slate-500">
                            {planName} • Expiry: {m.statusRes?.effectiveExpiryStr}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.statusRes?.badgeBg} ${m.statusRes?.badgeColor}`}>
                          {m.statusRes?.label}
                        </span>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                        >
                          <MessageSquare size={14} /> Send WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card title="Member Status Breakdown">
            {stats.totalMembers === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No member records registered</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={memberDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                      {memberDistData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => [`${val} members`, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Financial Overview (Last 6 Months)">
          {financialChartData.every((d) => d.Revenue === 0 && d.Expenses === 0) ? (
            <div className="py-12 text-center text-slate-400 text-sm">No financial records recorded for the last 6 months</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip formatter={(val: number) => formatINR(val)} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Profit" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Daily Attendance (Last 7 Days)">
          {attendanceChartData.every((d) => d.visits === 0) ? (
            <div className="py-12 text-center text-slate-400 text-sm">No attendance records logged for the last 7 days</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="visits" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. MEMBERS PAGE & COMPLETE PROFILE MODAL
// ----------------------------------------------------
export function MembersPage() {
  const [members, setMembers] = useState<Row[]>([]);
  const [adjustmentsMap, setAdjustmentsMap] = useState<Record<string, Row[]>>({});
  const [plans, setPlans] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [selectedMember, setSelectedMember] = useState<Row | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustDaysModal, setShowAdjustDaysModal] = useState(false);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Deep detail state for member profile
  const [memberPayments, setMemberPayments] = useState<Row[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<Row[]>([]);
  const [memberExtraCharges, setMemberExtraCharges] = useState<Row[]>([]);
  const [memberAdjustments, setMemberAdjustments] = useState<Row[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Row>({
    full_name: '',
    phone: '',
    email: '',
    gender: 'male',
    membership_plan_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    dob: '',
    address: '',
    emergency_contact: '',
    device_user_id: '',
    notes: '',
  });

  // Adjust days form
  const [adjustDays, setAdjustDays] = useState(5);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustIsFree, setAdjustIsFree] = useState(true);
  const [adjustCustomCharge, setAdjustCustomCharge] = useState<string>('');

  // Extra charge form
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [chargeNotes, setChargeNotes] = useState('');

  // Payment form
  const [paymentPlanId, setPaymentPlanId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const openRecordPaymentModalForMember = (member: Row) => {
    const initialPlanId = member.membership_plan_id || plans[0]?.id || '';
    setPaymentPlanId(initialPlanId);
    const matchedPlan = plans.find((p) => p.id === initialPlanId);
    setPaymentAmount(matchedPlan?.price ? String(matchedPlan.price) : '');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('cash');
    setPaymentNotes('');
    setShowRecordPaymentModal(true);
  };

  const handleRecordPaymentPlanChange = (planId: string) => {
    setPaymentPlanId(planId);
    const matchedPlan = plans.find((p) => p.id === planId);
    if (matchedPlan?.price) {
      setPaymentAmount(String(matchedPlan.price));
    }
  };

  // Permanent Delete form
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deletingMemberInProgress, setDeletingMemberInProgress] = useState(false);

  const handlePermanentDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    const expectedCode = (selectedMember.member_code || selectedMember.id).trim();

    if (deleteConfirmInput.trim().toLowerCase() !== expectedCode.toLowerCase()) {
      alert(`Member ID mismatch. You must type exact Member ID '${expectedCode}' to confirm deletion.`);
      return;
    }

    setDeletingMemberInProgress(true);
    try {
      const res = await fetch('/api/admin/delete-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          confirmCode: deleteConfirmInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to delete member.');
      }

      alert(data.message || 'Member permanently deleted.');
      setShowPermanentDeleteModal(false);
      setSelectedMember(null);
      setDeleteConfirmInput('');
      loadData();
    } catch (err: any) {
      alert(`Permanent Deletion Error: ${err.message}`);
    } finally {
      setDeletingMemberInProgress(false);
    }
  };

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;

    const [{ data: mData }, { data: adjData }, { data: pData }] = await Promise.all([
      client.from('members').select('*, membership_plans(id, name, price, duration_days)').order('created_at', { ascending: false }),
      client.from('membership_adjustments').select('*').order('created_at', { ascending: false }),
      client.from('membership_plans').select('*').order('display_order', { ascending: true }),
    ]);

    const adjMap: Record<string, Row[]> = {};
    (adjData ?? []).forEach((adj) => {
      if (!adjMap[adj.member_id]) adjMap[adj.member_id] = [];
      adjMap[adj.member_id].push(adj);
    });

    setMembers(mData ?? []);
    setAdjustmentsMap(adjMap);
    setPlans(pData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openMemberProfile = async (member: Row) => {
    setSelectedMember(member);
    const client = createBrowserClient();
    if (!client) return;

    const [{ data: pay }, { data: att }, { data: chg }, { data: adj }] = await Promise.all([
      client.from('payments').select('*, membership_plans(name)').eq('member_id', member.id).order('payment_date', { ascending: false }),
      client.from('attendance').select('*').eq('member_id', member.id).order('attendance_date', { ascending: false }).limit(30),
      client.from('extra_charges').select('*').eq('member_id', member.id).order('charge_date', { ascending: false }),
      client.from('membership_adjustments').select('*').eq('member_id', member.id).order('created_at', { ascending: false }),
    ]);

    setMemberPayments(pay ?? []);
    setMemberAttendance(att ?? []);
    setMemberExtraCharges(chg ?? []);
    setMemberAdjustments(adj ?? []);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, memberId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    const client = createBrowserClient();
    if (!client) return;

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `${memberId}/profile_${Date.now()}.${ext}`;

      const { error: uploadError } = await client.storage.from('member-photos').upload(storagePath, file, {
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = client.storage.from('member-photos').getPublicUrl(storagePath);
      const photoUrl = urlData.publicUrl;

      await client.from('members').update({
        photo_url: photoUrl,
        photo_storage_path: storagePath,
      }).eq('id', memberId);

      await writeAuditLog('UPDATE_PHOTO', 'member', memberId, `Uploaded profile picture`);
      await loadData();
      if (selectedMember?.id === memberId) {
        setSelectedMember((prev) => (prev ? { ...prev, photo_url: photoUrl, photo_storage_path: storagePath } : null));
      }
    } catch (err: any) {
      alert(`Photo upload failed: ${err.message}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (member: Row) => {
    if (!confirm('Are you sure you want to remove this profile picture?')) return;
    const client = createBrowserClient();
    if (!client) return;

    try {
      if (member.photo_storage_path) {
        await client.storage.from('member-photos').remove([member.photo_storage_path]);
      }
      await client.from('members').update({ photo_url: null, photo_storage_path: null }).eq('id', member.id);
      await writeAuditLog('DELETE_PHOTO', 'member', member.id, 'Removed profile picture');
      await loadData();
      if (selectedMember?.id === member.id) {
        setSelectedMember((prev) => (prev ? { ...prev, photo_url: null, photo_storage_path: null } : null));
      }
    } catch (err: any) {
      alert(`Delete photo failed: ${err.message}`);
    }
  };

  const handleCreateMember = async (e: FormEvent) => {
    e.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    const code = `RR-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: inserted, error: err } = await client
      .from('members')
      .insert({
        ...formData,
        member_code: code,
        status: 'active',
      })
      .select()
      .single();

    if (err) {
      alert(`Error creating member: ${err.message}`);
      return;
    }

    await writeAuditLog('CREATE_MEMBER', 'member', inserted.id, `Created member ${formData.full_name}`);
    setShowCreateModal(false);
    loadData();
  };

  const handleEditMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    const client = createBrowserClient();
    if (!client) return;

    const { error: err } = await client.from('members').update(formData).eq('id', selectedMember.id);
    if (err) {
      alert(`Error updating member: ${err.message}`);
      return;
    }

    await writeAuditLog('UPDATE_MEMBER', 'member', selectedMember.id, `Updated details`);
    setShowEditModal(false);
    loadData();
    openMemberProfile({ ...selectedMember, ...formData });
  };

  const handleToggleDeactivate = async (member: Row) => {
    const isCurrentlyDeactivated = member.status === 'deactivated' || member.status === 'inactive';
    const newStatus = isCurrentlyDeactivated ? 'active' : 'deactivated';
    const actionLabel = isCurrentlyDeactivated ? 'Reactivate' : 'Deactivate';

    if (!confirm(`Are you sure you want to ${actionLabel.toLowerCase()} ${member.full_name}?`)) return;

    const client = createBrowserClient();
    if (!client) return;

    const { data: updatedRows, error: updateErr } = await client
      .from('members')
      .update({ status: newStatus })
      .eq('id', member.id)
      .select('*, membership_plans(id, name, price, duration_days)');

    if (updateErr) {
      alert(`Failed to ${actionLabel.toLowerCase()} member in database: ${updateErr.message}`);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      alert(`Database status update failed: No rows were updated. Check admin authorization.`);
      return;
    }

    const updatedMember = updatedRows[0];

    await writeAuditLog(
      isCurrentlyDeactivated ? 'REACTIVATE_MEMBER' : 'DEACTIVATE_MEMBER',
      'member',
      member.id,
      `Successfully ${actionLabel.toLowerCase()}d member ${member.full_name}`
    );

    await loadData();

    if (selectedMember?.id === member.id) {
      openMemberProfile(updatedMember);
    }
  };

  const handleAdjustDaysSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    if (!adjustReason.trim()) {
      alert('Please provide a reason for the membership adjustment.');
      return;
    }

    const client = createBrowserClient();
    if (!client) return;

    const plan = selectedMember.membership_plans;
    const price = Number(plan?.price || 1000);
    const duration = Number(plan?.duration_days || 30);
    const dailyRate = price / duration;
    const calculatedCharge = adjustDays * dailyRate;
    const finalCharge = adjustIsFree ? 0 : adjustCustomCharge ? Number(adjustCustomCharge) : calculatedCharge;

    const currentEffective = calculateEffectiveExpiry(selectedMember.expiry_date, adjustmentsMap[selectedMember.id]);
    const newExpiry = new Date(currentEffective || new Date());
    newExpiry.setDate(newExpiry.getDate() + adjustDays);

    const { error: adjErr } = await client.from('membership_adjustments').insert({
      member_id: selectedMember.id,
      previous_expiry: formatDateISO(currentEffective),
      days_added: adjustDays,
      new_expiry: formatDateISO(newExpiry),
      daily_rate: dailyRate,
      calculated_charge: calculatedCharge,
      final_charge: finalCharge,
      is_free: adjustIsFree,
      reason: adjustReason,
      notes: adjustNotes,
    });

    if (adjErr) {
      alert(`Adjustment error: ${adjErr.message}`);
      return;
    }

    if (!adjustIsFree && finalCharge > 0) {
      await client.from('extra_charges').insert({
        member_id: selectedMember.id,
        amount: finalCharge,
        reason: `Membership extension (+${adjustDays} days)`,
        notes: adjustReason,
        status: 'UNPAID',
      });
    }

    await writeAuditLog('ADJUST_MEMBERSHIP', 'member', selectedMember.id, `Added ${adjustDays} days (${adjustIsFree ? 'Free' : `₹${finalCharge}`})`);
    setShowAdjustDaysModal(false);
    setAdjustReason('');
    setAdjustNotes('');
    await loadData();
    openMemberProfile(selectedMember);
  };

  const handleAddExtraCharge = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !chargeAmount) return;

    const client = createBrowserClient();
    if (!client) return;

    const { error: err } = await client.from('extra_charges').insert({
      member_id: selectedMember.id,
      amount: Number(chargeAmount),
      reason: chargeReason || 'Extra Fee',
      notes: chargeNotes,
      status: 'UNPAID',
    });

    if (err) {
      alert(`Error adding charge: ${err.message}`);
      return;
    }

    await writeAuditLog('ADD_CHARGE', 'extra_charge', selectedMember.id, `Added ₹${chargeAmount} charge (${chargeReason})`);
    setShowExtraChargeModal(false);
    setChargeAmount('');
    setChargeReason('');
    setChargeNotes('');
    openMemberProfile(selectedMember);
  };

  const handleRecordPaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !paymentAmount) return;

    const client = createBrowserClient();
    if (!client) return;

    const selectedPlan = plans.find((p) => p.id === paymentPlanId) || plans.find((p) => p.id === selectedMember.membership_plan_id) || plans[0];
    const durationDays = Number(selectedPlan?.duration_days || 30);

    const calcRes = calculateRenewalDates({
      currentMember: selectedMember,
      durationDays,
      paymentDateStr: paymentDate || new Date().toISOString().slice(0, 10),
    });

    const isAmountOverridden = selectedPlan && Number(selectedPlan.price) !== Number(paymentAmount);
    const overrideNote = isAmountOverridden ? ` (Custom fee ₹${paymentAmount}, Plan original ₹${selectedPlan.price})` : '';

    const { data: createdPayment, error: err } = await client.from('payments').insert({
      member_id: selectedMember.id,
      membership_plan_id: selectedPlan?.id || selectedMember.membership_plan_id || null,
      amount: Number(paymentAmount),
      payment_date: paymentDate || new Date().toISOString().slice(0, 10),
      payment_method: paymentMethod,
      membership_start_date: calcRes.paymentStartDate,
      membership_end_date: calcRes.paymentEndDate,
      notes: (paymentNotes || '') + overrideNote,
    }).select().single();

    if (err) {
      alert(`Payment error: ${err.message}`);
      return;
    }

    const { error: memErr } = await client.from('members').update({
      membership_plan_id: selectedPlan?.id || selectedMember.membership_plan_id,
      start_date: calcRes.memberStartDate,
      expiry_date: calcRes.memberExpiryDate,
      status: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', selectedMember.id);

    if (memErr) {
      alert(`Member status update error: ${memErr.message}`);
      return;
    }

    await writeAuditLog(
      'RECORD_PAYMENT',
      'payment',
      createdPayment.id,
      `Recorded ₹${paymentAmount} via ${paymentMethod} for ${selectedMember.full_name} (${calcRes.paymentStartDate} → ${calcRes.paymentEndDate})${overrideNote}`
    );

    setShowRecordPaymentModal(false);
    setPaymentAmount('');
    setPaymentNotes('');

    await loadData();

    // Re-fetch updated member profile to reflect refreshed dates & status immediately
    const { data: updatedMem } = await client.from('members').select('*, membership_plans(name, price)').eq('id', selectedMember.id).single();
    if (updatedMem) {
      openMemberProfile(updatedMem);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search) ||
        (m.member_code || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;
      if (statusFilter === 'all') return true;

      const statusRes = calculateMembershipStatus(m, adjustmentsMap[m.id]);
      if (statusFilter === 'active') return statusRes.status === 'ACTIVE' || statusRes.status === 'EXPIRING_SOON';
      if (statusFilter === 'expiring') return statusRes.status === 'EXPIRING_SOON';
      if (statusFilter === 'expired') return statusRes.status === 'EXPIRED';
      if (statusFilter === 'deactivated') return statusRes.status === 'DEACTIVATED';
      return true;
    });
  }, [members, search, statusFilter, adjustmentsMap]);

  if (loading) {
    return <div className="py-12 text-center text-slate-500 text-sm">Loading gym members directory…</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClassName} pl-10`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm focus:outline-none focus:border-red-600 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Members</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired Members</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>

        <button
          onClick={() => {
            setFormData({
              full_name: '',
              phone: '',
              email: '',
              gender: 'male',
              membership_plan_id: plans[0]?.id || '',
              start_date: new Date().toISOString().slice(0, 10),
              expiry_date: '',
              dob: '',
              address: '',
              emergency_contact: '',
              device_user_id: '',
              notes: '',
            });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm shrink-0"
        >
          <UserPlus size={18} />
          <span>Add New Member</span>
        </button>
      </div>

      {/* MEMBERS DIRECTORY */}
      <Card title={`Members Directory (${filteredMembers.length})`}>
        {filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No members found matching your search</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] font-extrabold bg-slate-50">
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">ID / Phone</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Effective Expiry</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((m) => {
                    const statusRes = calculateMembershipStatus(m, adjustmentsMap[m.id]);
                    const planName = m.membership_plans?.name || 'No Plan';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            {m.photo_url ? (
                              <img src={m.photo_url} alt={m.full_name} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <InitialsAvatar name={m.full_name} className="w-9 h-9 text-xs" />
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{m.full_name}</div>
                              <div className="text-xs text-slate-500 capitalize">{m.gender || 'Member'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-xs text-slate-700 font-semibold">{m.member_code || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{m.phone}</div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{planName}</td>
                        <td className="py-3 px-3 text-slate-700 font-medium">{statusRes.effectiveExpiryStr}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusRes.badgeBg} ${statusRes.badgeColor}`}>
                            {statusRes.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => openMemberProfile(m)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredMembers.map((m) => {
                const statusRes = calculateMembershipStatus(m, adjustmentsMap[m.id]);
                const planName = m.membership_plans?.name || 'No Plan';

                return (
                  <div key={m.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.full_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <InitialsAvatar name={m.full_name} />
                        )}
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{m.full_name}</div>
                          <div className="text-xs text-slate-500 font-mono">{m.member_code || m.phone}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusRes.badgeBg} ${statusRes.badgeColor}`}>
                        {statusRes.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div><span className="font-semibold text-slate-400">Plan:</span> {planName}</div>
                      <div><span className="font-semibold text-slate-400">Expiry:</span> {statusRes.effectiveExpiryStr}</div>
                    </div>
                    <button
                      onClick={() => openMemberProfile(m)}
                      className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow-sm"
                    >
                      View Profile & Actions
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* COMPLETE MEMBER PROFILE MODAL */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  {selectedMember.photo_url ? (
                    <img src={selectedMember.photo_url} alt={selectedMember.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-red-600 shadow-sm" />
                  ) : (
                    <InitialsAvatar name={selectedMember.full_name} className="w-12 h-12 text-base" />
                  )}
                  <label className="absolute bottom-0 right-0 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-sm">
                    <Upload size={12} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, selectedMember.id)}
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 m-0">{selectedMember.full_name}</h2>
                    <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                      {selectedMember.member_code || 'ID pending'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{selectedMember.phone} • Registered {formatDateDisplay(selectedMember.created_at)}</div>
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            {/* Profile Body Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {/* Quick Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <a
                  href={formatWhatsAppReminderUrl(selectedMember, selectedMember.membership_plans?.name, calculateMembershipStatus(selectedMember, memberAdjustments).effectiveExpiryStr)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <MessageSquare size={14} /> WhatsApp Reminder
                </a>
                <button
                  onClick={() => {
                    setFormData({
                      full_name: selectedMember.full_name,
                      phone: selectedMember.phone,
                      email: selectedMember.email || '',
                      gender: selectedMember.gender || 'male',
                      membership_plan_id: selectedMember.membership_plan_id || '',
                      start_date: selectedMember.start_date || '',
                      expiry_date: selectedMember.expiry_date || '',
                      dob: selectedMember.dob || '',
                      address: selectedMember.address || '',
                      emergency_contact: selectedMember.emergency_contact || '',
                      device_user_id: selectedMember.device_user_id || '',
                      notes: selectedMember.notes || '',
                    });
                    setShowEditModal(true);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5"
                >
                  <Edit size={14} /> Edit Profile
                </button>
                <button
                  onClick={() => openRecordPaymentModalForMember(selectedMember)}
                  className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <CreditCard size={14} /> Record Payment
                </button>
                <button
                  onClick={() => setShowAdjustDaysModal(true)}
                  className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} /> Add Extra Days
                </button>
                <button
                  onClick={() => setShowExtraChargeModal(true)}
                  className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <DollarSign size={14} /> Add Fine/Charge
                </button>
                <button
                  onClick={() => handleToggleDeactivate(selectedMember)}
                  className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 ${
                    selectedMember.status === 'deactivated'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {selectedMember.status === 'deactivated' ? 'Reactivate Member' : 'Deactivate Member'}
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirmInput('');
                    setShowPermanentDeleteModal(true);
                  }}
                  className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 ml-auto shadow-sm"
                >
                  <Trash2 size={14} /> Delete Member Permanently
                </button>
              </div>

              {/* Grid 1: Personal & Membership Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm border-b border-slate-200 pb-2">PERSONAL INFORMATION</h4>
                  <div className="text-xs space-y-1.5 text-slate-700">
                    <div><span className="font-semibold text-slate-500">Full Name:</span> {selectedMember.full_name}</div>
                    <div><span className="font-semibold text-slate-500">Phone:</span> {selectedMember.phone}</div>
                    <div><span className="font-semibold text-slate-500">Email:</span> {selectedMember.email || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-500">DOB:</span> {formatDateDisplay(selectedMember.dob)}</div>
                    <div><span className="font-semibold text-slate-500">Address:</span> {selectedMember.address || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-500">Emergency Contact:</span> {selectedMember.emergency_contact || 'N/A'}</div>
                    {selectedMember.photo_url && (
                      <button onClick={() => handleDeletePhoto(selectedMember)} className="mt-2 text-[11px] font-bold text-red-600 hover:underline">
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm border-b border-slate-200 pb-2">MEMBERSHIP & ACCESS</h4>
                  {(() => {
                    const statusRes = calculateMembershipStatus(selectedMember, memberAdjustments);
                    return (
                      <div className="text-xs space-y-1.5 text-slate-700">
                        <div><span className="font-semibold text-slate-500">Plan:</span> {selectedMember.membership_plans?.name || 'No Plan'}</div>
                        <div><span className="font-semibold text-slate-500">Start Date:</span> {formatDateDisplay(selectedMember.start_date)}</div>
                        <div><span className="font-semibold text-slate-500">Original Expiry:</span> {formatDateDisplay(selectedMember.expiry_date)}</div>
                        <div><span className="font-semibold text-slate-500">Effective Expiry:</span> {statusRes.effectiveExpiryStr}</div>
                        <div><span className="font-semibold text-slate-500">Status:</span> <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusRes.badgeBg} ${statusRes.badgeColor}`}>{statusRes.label}</span></div>
                        <div><span className="font-semibold text-slate-500">Device User ID:</span> <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">{selectedMember.device_user_id || 'Unmapped'}</span></div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Grid 2: Payment History & Extra Charges */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm m-0">PAYMENT & EXTRA CHARGES HISTORY</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                        <th className="p-2">Date</th>
                        <th className="p-2">Plan</th>
                        <th className="p-2">Paid Membership Period</th>
                        <th className="p-2">Method</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2 font-medium">{formatDateDisplay(p.payment_date)}</td>
                          <td className="p-2 font-bold text-slate-800">{p.membership_plans?.name || 'Gym Plan'}</td>
                          <td className="p-2 font-medium text-slate-700">
                            {p.membership_start_date ? `${formatDateDisplay(p.membership_start_date)} → ${formatDateDisplay(p.membership_end_date)}` : 'N/A'}
                          </td>
                          <td className="p-2 uppercase font-bold text-slate-600">{p.payment_method}</td>
                          <td className="p-2 font-bold text-emerald-700">{formatINR(Number(p.amount))}</td>
                          <td className="p-2"><span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">PAID</span></td>
                          <td className="p-2 text-slate-500">{p.notes || '-'}</td>
                        </tr>
                      ))}
                      {memberExtraCharges.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-2 font-medium">{formatDateDisplay(c.charge_date)}</td>
                          <td className="p-2 text-slate-400">-</td>
                          <td className="p-2 font-bold text-purple-700">Fine/Charge ({c.reason})</td>
                          <td className="p-2 text-slate-400">-</td>
                          <td className="p-2 font-bold text-slate-900">{formatINR(Number(c.amount))}</td>
                          <td className="p-2">
                            <span className={`font-bold px-2 py-0.5 rounded ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="p-2 text-slate-500">{c.notes || '-'}</td>
                        </tr>
                      ))}
                      {memberPayments.length === 0 && memberExtraCharges.length === 0 && (
                        <tr><td colSpan={7} className="p-4 text-center text-slate-400">No payment or charge records logged.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grid 3: Membership Adjustments History */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm m-0">EXTRA-DAY ADJUSTMENT LOGS</h4>
                <div className="space-y-2">
                  {memberAdjustments.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 bg-slate-50 rounded-lg text-center">No extra day adjustments recorded yet.</div>
                  ) : (
                    memberAdjustments.map((adj) => (
                      <div key={adj.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">
                            +{adj.days_added} Days added ({adj.is_free ? 'FREE Extension' : `Charged ${formatINR(Number(adj.final_charge))}`})
                          </div>
                          <div className="text-slate-500 mt-0.5">Reason: {adj.reason} {adj.notes ? `• ${adj.notes}` : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-slate-700">Expiry: {formatDateDisplay(adj.previous_expiry)} → {formatDateDisplay(adj.new_expiry)}</div>
                          <div className="text-[10px] text-slate-400">{formatDateDisplay(adj.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Grid 4: Recent Attendance */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm m-0">RECENT ATTENDANCE VISITS</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {memberAttendance.slice(0, 8).map((att) => (
                    <div key={att.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="font-bold text-slate-900">{formatDateDisplay(att.attendance_date)}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{att.entry_time || 'Check-in'} ({att.source || 'manual'})</div>
                    </div>
                  ))}
                  {memberAttendance.length === 0 && (
                    <div className="col-span-full py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">No attendance recorded yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MEMBER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">Register New Member</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateMember} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input required value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className={inputClassName} placeholder="Rahul Sharma" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClassName} placeholder="9876543210" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className={inputClassName}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Membership Plan</label>
                  <select value={formData.membership_plan_id} onChange={(e) => setFormData({ ...formData, membership_plan_id: e.target.value })} className={inputClassName}>
                    <option value="">Select Plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({formatINR(Number(p.price))})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className={inputClassName} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                  <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Biometric Device User ID</label>
                  <input value={formData.device_user_id} onChange={(e) => setFormData({ ...formData, device_user_id: e.target.value })} className={inputClassName} placeholder="101" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
                <input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClassName} placeholder="Roorkee, Uttarakhand" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Create Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">Edit Member Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditMember} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input required value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className={inputClassName} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClassName} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                  <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} className={inputClassName} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Biometric Device User ID</label>
                <input value={formData.device_user_id} onChange={(e) => setFormData({ ...formData, device_user_id: e.target.value })} className={inputClassName} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST EXTRA DAYS MODAL */}
      {showAdjustDaysModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">Add Extra Membership Days</h3>
              <button onClick={() => setShowAdjustDaysModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustDaysSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Extra Days to Add *</label>
                <input type="number" min="1" max="365" required value={adjustDays} onChange={(e) => setAdjustDays(Number(e.target.value))} className={inputClassName} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Extension Type</label>
                <div className="flex gap-4 items-center pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input type="radio" name="extType" checked={adjustIsFree} onChange={() => setAdjustIsFree(true)} />
                    FREE Extension (₹0)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input type="radio" name="extType" checked={!adjustIsFree} onChange={() => setAdjustIsFree(false)} />
                    CHARGE Member
                  </label>
                </div>
              </div>
              {!adjustIsFree && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Charge Amount (₹)</label>
                  <input
                    type="number"
                    placeholder={`Calculated: ₹${Math.round(adjustDays * ((Number(selectedMember.membership_plans?.price) || 1000) / 30))}`}
                    value={adjustCustomCharge}
                    onChange={(e) => setAdjustCustomCharge(e.target.value)}
                    className={inputClassName}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Leave empty to use auto-calculated plan daily rate.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Adjustment *</label>
                <input required placeholder="e.g. Gym closure compensation / Special offer" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className={inputClassName} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className={inputClassName} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAdjustDaysModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm">Confirm Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXTRA CHARGE / FINE MODAL */}
      {showExtraChargeModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">Add Extra Charge / Fine</h3>
              <button onClick={() => setShowExtraChargeModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddExtraCharge} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input type="number" required placeholder="500" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} className={inputClassName} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Description *</label>
                <input required placeholder="e.g. Late fee / Personal Training / Locker fee" value={chargeReason} onChange={(e) => setChargeReason(e.target.value)} className={inputClassName} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} className={inputClassName} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowExtraChargeModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm">Save Charge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showRecordPaymentModal && selectedMember && (() => {
        const activePlan = plans.find((p) => p.id === paymentPlanId) || plans.find((p) => p.id === selectedMember.membership_plan_id) || plans[0];
        const planDuration = Number(activePlan?.duration_days || 30);
        const calcRes = calculateRenewalDates({
          currentMember: selectedMember,
          durationDays: planDuration,
          paymentDateStr: paymentDate,
        });
        const isOverridden = activePlan && Number(activePlan.price) !== Number(paymentAmount);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 m-0">Record Membership Renewal</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{selectedMember.full_name} ({selectedMember.member_code || selectedMember.phone})</div>
                </div>
                <button onClick={() => setShowRecordPaymentModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
              </div>
              <form onSubmit={handleRecordPaymentSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Membership Plan *</label>
                  <select
                    required
                    value={paymentPlanId}
                    onChange={(e) => handleRecordPaymentPlanChange(e.target.value)}
                    className={inputClassName}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.price} ({p.duration_days || 30} days)</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹) *</label>
                    <input
                      type="number"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={inputClassName}
                      placeholder={activePlan?.price || '1000'}
                    />
                    {isOverridden && (
                      <div className="text-[10px] text-amber-600 font-bold mt-1">Manual Price Override (Original ₹{activePlan?.price})</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClassName}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="online">Online</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {/* Membership Period Calculation Preview Card */}
                <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl space-y-1.5 text-xs text-slate-700">
                  <div className="font-extrabold text-red-900 flex items-center justify-between">
                    <span>RENEWAL PERIOD COVERED</span>
                    <span className="text-[10px] uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded font-black">
                      {calcRes.isExtension ? 'Extension' : 'New Start'}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {formatDateDisplay(calcRes.paymentStartDate)} → {formatDateDisplay(calcRes.paymentEndDate)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Member status will update to <span className="font-extrabold text-emerald-700">ACTIVE</span> (Expiry: {formatDateDisplay(calcRes.memberExpiryDate)})
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                  <textarea rows={2} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className={inputClassName} placeholder="Renewal payment" />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowRecordPaymentModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Save & Activate Renewal</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* PERMANENT DELETE MEMBER MODAL */}
      {showPermanentDeleteModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white border border-red-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert size={24} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-red-600 m-0">PERMANENTLY DELETE MEMBER</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                This will permanently delete member <strong>{selectedMember.full_name}</strong> and all associated authentication credentials and records.
              </p>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px] font-bold">
                ⚠️ WARNING: This action CANNOT be undone!
              </div>
            </div>

            <form onSubmit={handlePermanentDeleteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  To confirm, type exact Member ID <code className="bg-slate-100 text-red-600 font-mono px-1 py-0.5 rounded">{selectedMember.member_code || selectedMember.id}</code> below:
                </label>
                <input
                  type="text"
                  required
                  placeholder={selectedMember.member_code || selectedMember.id}
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPermanentDeleteModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    deletingMemberInProgress ||
                    deleteConfirmInput.trim().toLowerCase() !== (selectedMember.member_code || selectedMember.id).trim().toLowerCase()
                  }
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition-colors"
                >
                  {deletingMemberInProgress ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 3. PAYMENTS PAGE (FULL MANAGEMENT RESTORED)
// ----------------------------------------------------
export function PaymentsPage() {
  const [payments, setPayments] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  // Modals state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Row | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Row | null>(null);

  // Form state for Recording / Editing payment
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;

    const [{ data: payData, error: payErr }, { data: memData }, { data: planData }] = await Promise.all([
      client.from('payments').select('*, members(id, full_name, member_code, phone, expiry_date), membership_plans(id, name, price, duration_days)').order('payment_date', { ascending: false }),
      client.from('members').select('id, full_name, member_code, phone, expiry_date, membership_plan_id').order('full_name', { ascending: true }),
      client.from('membership_plans').select('id, name, price, duration_days').order('display_order', { ascending: true }),
    ]);

    if (payErr) {
      alert(`Error fetching payments: ${payErr.message}`);
    }

    setPayments(payData ?? []);
    setMembers(memData ?? []);
    setPlans(planData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMemberSelectChange = (memId: string) => {
    setSelectedMemberId(memId);
    const targetMember = members.find((m) => m.id === memId);
    const planId = selectedPlanId || targetMember?.membership_plan_id || plans[0]?.id || '';
    if (planId) {
      setSelectedPlanId(planId);
      const matchedPlan = plans.find((p) => p.id === planId);
      if (matchedPlan?.price) setAmount(String(matchedPlan.price));
      const calcRes = calculateRenewalDates({
        currentMember: targetMember,
        durationDays: Number(matchedPlan?.duration_days || 30),
        paymentDateStr: paymentDate,
      });
      setStartDate(calcRes.paymentStartDate);
      setEndDate(calcRes.paymentEndDate);
    }
  };

  const handlePlanSelectChange = (planId: string) => {
    setSelectedPlanId(planId);
    const matchedPlan = plans.find((p) => p.id === planId);
    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (matchedPlan) {
      if (matchedPlan.price) setAmount(String(matchedPlan.price));
      const calcRes = calculateRenewalDates({
        currentMember: targetMember,
        durationDays: Number(matchedPlan.duration_days || 30),
        paymentDateStr: paymentDate,
      });
      setStartDate(calcRes.paymentStartDate);
      setEndDate(calcRes.paymentEndDate);
    }
  };

  const handlePaymentDateChange = (payDateStr: string) => {
    setPaymentDate(payDateStr);
    const matchedPlan = plans.find((p) => p.id === selectedPlanId);
    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (matchedPlan) {
      const calcRes = calculateRenewalDates({
        currentMember: targetMember,
        durationDays: Number(matchedPlan.duration_days || 30),
        paymentDateStr: payDateStr,
      });
      setStartDate(calcRes.paymentStartDate);
      setEndDate(calcRes.paymentEndDate);
    }
  };

  const handleStartDateChange = (dateStr: string) => {
    setStartDate(dateStr);
    const matchedPlan = plans.find((p) => p.id === selectedPlanId);
    const duration = Number(matchedPlan?.duration_days || 30);
    const start = parseLocalDate(dateStr) || new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + duration - 1);
    setEndDate(formatDateISO(end));
  };

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      alert('Please select a member.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    const client = createBrowserClient();
    if (!client) return;

    const targetMember = members.find((m) => m.id === selectedMemberId);
    const matchedPlan = plans.find((p) => p.id === selectedPlanId);

    const calcRes = calculateRenewalDates({
      currentMember: targetMember,
      durationDays: Number(matchedPlan?.duration_days || 30),
      paymentDateStr: paymentDate,
    });

    const finalStartDate = startDate || calcRes.paymentStartDate;
    const finalEndDate = endDate || calcRes.paymentEndDate;

    const isAmountOverridden = matchedPlan && Number(matchedPlan.price) !== Number(amount);
    const overrideNote = isAmountOverridden ? ` (Custom fee ₹${amount}, Plan price ₹${matchedPlan.price})` : '';

    const { data: createdPayment, error: payErr } = await client.from('payments').insert({
      member_id: selectedMemberId,
      membership_plan_id: selectedPlanId || null,
      amount: Number(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      membership_start_date: finalStartDate,
      membership_end_date: finalEndDate,
      notes: (notes || '') + overrideNote,
    }).select().single();

    if (payErr) {
      alert(`Failed to record payment: ${payErr.message}`);
      return;
    }

    // Update member record: start_date, expiry_date, status = 'active'
    if (targetMember) {
      const { error: memErr } = await client.from('members').update({
        membership_plan_id: selectedPlanId || targetMember.membership_plan_id,
        start_date: calcRes.memberStartDate,
        expiry_date: calcRes.memberExpiryDate,
        status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', selectedMemberId);

      if (memErr) {
        alert(`Member update error: ${memErr.message}`);
        return;
      }
    }

    await writeAuditLog('RECORD_PAYMENT', 'payment', createdPayment.id, `Recorded ₹${amount} for ${targetMember?.full_name || 'Member'} (${finalStartDate} → ${finalEndDate})${overrideNote}`);

    setShowRecordModal(false);
    resetForm();
    await loadData();
  };

  const handleUpdatePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const client = createBrowserClient();
    if (!client) return;

    const { error: editErr } = await client.from('payments').update({
      amount: Number(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      membership_start_date: startDate || null,
      membership_end_date: endDate || null,
      notes: notes || null,
    }).eq('id', editingPayment.id);

    if (editErr) {
      alert(`Error updating payment: ${editErr.message}`);
      return;
    }

    await writeAuditLog('EDIT_PAYMENT', 'payment', editingPayment.id, `Updated payment to ₹${amount}`);
    setEditingPayment(null);
    resetForm();
    loadData();
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;

    const client = createBrowserClient();
    if (!client) return;

    const { error: delErr } = await client.from('payments').delete().eq('id', deletingPayment.id);
    if (delErr) {
      alert(`Error deleting payment: ${delErr.message}`);
      return;
    }

    await writeAuditLog('DELETE_PAYMENT', 'payment', deletingPayment.id, `Deleted payment record ₹${deletingPayment.amount}`);
    setDeletingPayment(null);
    loadData();
  };

  const openEditModal = (p: Row) => {
    setEditingPayment(p);
    setSelectedMemberId(p.member_id);
    setSelectedPlanId(p.membership_plan_id || '');
    setAmount(String(p.amount));
    setPaymentDate(p.payment_date);
    setPaymentMethod(p.payment_method);
    setStartDate(p.membership_start_date || p.payment_date);
    setEndDate(p.membership_end_date || '');
    setNotes(p.notes || '');
  };

  const resetForm = () => {
    setSelectedMemberId('');
    setSelectedPlanId('');
    setAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('cash');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setNotes('');
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const memberName = p.members?.full_name || '';
      const memberCode = p.members?.member_code || '';
      const matchSearch = memberName.toLowerCase().includes(search.toLowerCase()) || memberCode.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      return true;
    });
  }, [payments, search, methodFilter]);

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading payment transactions directory…</div>;

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search payment by member name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClassName} pl-10`}
            />
          </div>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm focus:outline-none focus:border-red-600 font-medium"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowRecordModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm shrink-0"
        >
          <Plus size={18} />
          <span>Record New Payment</span>
        </button>
      </div>

      {/* PAYMENTS DIRECTORY TABLE & CARDS */}
      <Card title={`Payment Transactions (${filteredPayments.length})`}>
        {filteredPayments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No payment transactions found matching filter</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] font-extrabold bg-slate-50">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Period</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-slate-700 font-medium">{formatDateDisplay(p.payment_date)}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{p.members?.full_name || 'Member'}</div>
                        <div className="text-xs text-slate-400 font-mono">{p.members?.member_code || p.members?.phone}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{p.membership_plans?.name || 'General Fee'}</td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {p.membership_start_date ? `${formatDateDisplay(p.membership_start_date)} → ${formatDateDisplay(p.membership_end_date)}` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 uppercase text-xs font-bold text-slate-600">{p.payment_method}</td>
                      <td className="py-3 px-3 font-black text-emerald-700 text-base">{formatINR(Number(p.amount))}</td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button onClick={() => openEditModal(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setDeletingPayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden space-y-3">
              {filteredPayments.map((p) => (
                <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{p.members?.full_name || 'Member'}</div>
                      <div className="text-xs text-slate-500">{formatDateDisplay(p.payment_date)} • <span className="uppercase font-semibold">{p.payment_method}</span></div>
                    </div>
                    <div className="font-black text-emerald-700 text-base">{formatINR(Number(p.amount))}</div>
                  </div>
                  <div className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 flex justify-between">
                    <span>Plan: <strong>{p.membership_plans?.name || 'Gym Plan'}</strong></span>
                    <span>Period: <strong>{formatDateDisplay(p.membership_end_date)}</strong></span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={() => openEditModal(p)} className="px-3 py-1 rounded bg-slate-200 text-slate-800 font-bold text-xs">Edit</button>
                    <button onClick={() => setDeletingPayment(p)} className="px-3 py-1 rounded bg-red-100 text-red-700 font-bold text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* RECORD PAYMENT MODAL */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">Record Gym Payment</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Member *</label>
                <select required value={selectedMemberId} onChange={(e) => handleMemberSelectChange(e.target.value)} className={inputClassName}>
                  <option value="">Select Member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.member_code || m.phone})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plan</label>
                  <select value={selectedPlanId} onChange={(e) => handlePlanSelectChange(e.target.value)} className={inputClassName}>
                    <option value="">Select Plan</option>
                    {plans.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.name} ({formatINR(Number(pl.price))})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClassName} placeholder="1000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                  <input type="date" value={paymentDate} onChange={(e) => handlePaymentDateChange(e.target.value)} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClassName}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="online">Online</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Membership Start</label>
                  <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Membership End</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClassName} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClassName} placeholder="Monthly renewal payment" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowRecordModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PAYMENT MODAL */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">Edit Payment Record</h3>
              <button onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
              Warning: Modifying a recorded payment updates revenue metrics and financial reports.
            </div>
            <form onSubmit={handleUpdatePayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClassName} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClassName}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="online">Online</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClassName} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingPayment(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Update Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PAYMENT CONFIRMATION MODAL */}
      {deletingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 m-0">Confirm Delete Payment</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete payment of <strong>{formatINR(Number(deletingPayment.amount))}</strong> for <strong>{deletingPayment.members?.full_name}</strong>?
              </p>
              <p className="text-[11px] text-red-600 font-bold">
                Deleting this payment may affect membership dates and financial reports.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setDeletingPayment(null)} className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
              <button onClick={handleDeletePayment} className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 4. ATTENDANCE PAGE
// ----------------------------------------------------
export function AttendancePage() {
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;

    const [{ data: attData }, { data: memData }] = await Promise.all([
      client.from('attendance').select('*, members(full_name, member_code)').order('attendance_date', { ascending: false }).limit(100),
      client.from('members').select('id, full_name, member_code').order('full_name', { ascending: true }),
    ]);

    setAttendance(attData ?? []);
    setMembers(memData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualCheckIn = async () => {
    if (!selectedMemberId) return;
    const client = createBrowserClient();
    if (!client) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5);

    const { error: err } = await client.from('attendance').insert({
      member_id: selectedMemberId,
      attendance_date: todayStr,
      entry_time: timeStr,
      source: 'manual',
    });

    if (err) {
      alert(`Attendance check-in error: ${err.message}`);
      return;
    }

    await writeAuditLog('MANUAL_ATTENDANCE', 'attendance', selectedMemberId, `Logged visit at ${timeStr}`);
    setSelectedMemberId('');
    loadData();
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading attendance records…</div>;

  return (
    <div className="space-y-6">
      <Card title="Quick Manual Check-In">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center max-w-xl">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className={`${inputClassName} flex-1`}
          >
            <option value="">Select Member for Check-in…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name} ({m.member_code || 'ID'})</option>
            ))}
          </select>
          <button
            onClick={handleManualCheckIn}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm shrink-0"
          >
            Record Entry
          </button>
        </div>
      </Card>

      <Card title={`Recent Gym Visits (${attendance.length})`}>
        {attendance.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No attendance records logged yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] font-extrabold bg-slate-50">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Member</th>
                  <th className="py-3 px-3">Entry Time</th>
                  <th className="py-3 px-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-700 font-medium">{formatDateDisplay(a.attendance_date)}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{a.members?.full_name || 'Member'}</div>
                      <div className="text-xs text-slate-400 font-mono">{a.members?.member_code}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{a.entry_time || 'Check-in'}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${a.source === 'essl_x990' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>
                        {a.source || 'manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// 5. EXPENSES PAGE
// ----------------------------------------------------
export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electricity');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('expenses').select('*').order('expense_date', { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;
    const client = createBrowserClient();
    if (!client) return;

    await client.from('expenses').insert({
      title,
      category,
      amount: Number(amount),
      expense_date: expenseDate,
    });

    await writeAuditLog('ADD_EXPENSE', 'expense', undefined, `Added ${title} - ₹${amount}`);
    setTitle('');
    setAmount('');
    loadData();
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading expense records…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7">
        <Card title={`Expense History (${expenses.length})`}>
          {expenses.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No expenses recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] font-extrabold bg-slate-50">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Title / Category</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-700 font-medium">{formatDateDisplay(e.expense_date)}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{e.title}</div>
                        <div className="text-xs text-slate-500">{e.category}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-red-600">{formatINR(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card title="Record New Expense">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expense Title *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} placeholder="Electricity Bill" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClassName}>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClassName} placeholder="2500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expense Date</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={inputClassName} />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors">
              Save Expense
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. REPORTS PAGE (FULL SUITE RESTORED)
// ----------------------------------------------------
export function ReportsPage() {
  const [rangeType, setRangeType] = useState<'this_month' | 'last_month' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    paymentsList: [] as Row[],
    expensesList: [] as Row[],
    attendanceCount: 0,
    renewalsCount: 0,
  });

  const calculateDateBounds = () => {
    const today = new Date();
    if (rangeType === 'this_month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      return { start: `${year}-${month}-01`, end: today.toISOString().slice(0, 10) };
    } else if (rangeType === 'last_month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const year = lastMonth.getFullYear();
      const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, lastMonth.getMonth() + 1, 0).getDate();
      return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(lastDay).padStart(2, '0')}` };
    }
    return { start: startDate, end: endDate };
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    const client = createBrowserClient();
    if (!client) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    try {
      const bounds = calculateDateBounds();
      const [{ data: payData, error: payErr }, { data: expData, error: expErr }, { data: attData }] = await Promise.all([
        client.from('payments').select('*, members(full_name, member_code), membership_plans(name)').order('payment_date', { ascending: false }),
        client.from('expenses').select('*').order('expense_date', { ascending: false }),
        client.from('attendance').select('*'),
      ]);

      if (payErr) throw payErr;
      if (expErr) throw expErr;

      const filteredPayments = (payData ?? []).filter((p) => {
        if (!bounds.start && !bounds.end) return true;
        const d = p.payment_date;
        if (bounds.start && d < bounds.start) return false;
        if (bounds.end && d > bounds.end) return false;
        return true;
      });

      const filteredExpenses = (expData ?? []).filter((e) => {
        if (!bounds.start && !bounds.end) return true;
        const d = e.expense_date;
        if (bounds.start && d < bounds.start) return false;
        if (bounds.end && d > bounds.end) return false;
        return true;
      });

      const filteredAtt = (attData ?? []).filter((a) => {
        if (!bounds.start && !bounds.end) return true;
        const d = a.attendance_date;
        if (bounds.start && d < bounds.start) return false;
        if (bounds.end && d > bounds.end) return false;
        return true;
      });

      const rev = filteredPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const exp = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

      setReportData({
        totalRevenue: rev,
        totalExpenses: exp,
        netProfit: rev - exp,
        paymentsList: filteredPayments,
        expensesList: filteredExpenses,
        attendanceCount: filteredAtt.length,
        renewalsCount: filteredPayments.length,
      });
    } catch (err: any) {
      setError(`Failed to generate report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [rangeType, startDate, endDate]);

  const exportCSV = () => {
    if (reportData.paymentsList.length === 0 && reportData.expensesList.length === 0) {
      alert('No data available to export.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'TYPE,DATE,NAME/TITLE,METHOD/CATEGORY,AMOUNT\n';

    reportData.paymentsList.forEach((p) => {
      csvContent += `PAYMENT,${p.payment_date},"${p.members?.full_name || 'Member'}",${p.payment_method},${p.amount}\n`;
    });

    reportData.expensesList.forEach((e) => {
      csvContent += `EXPENSE,${e.expense_date},"${e.title}",${e.category},${e.amount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rr_fitness_report_${rangeType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* FILTER TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-extrabold text-slate-500 uppercase">Range:</span>
          <select
            value={rangeType}
            onChange={(e) => setRangeType(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold focus:outline-none focus:border-red-600"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {rangeType === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800" />
            </div>
          )}
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          <Download size={15} /> Export CSV Report
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Received Revenue" value={formatINR(reportData.totalRevenue)} icon={<DollarSign size={18} />} color="#16a34a" />
        <StatCard title="Total Expenses" value={formatINR(reportData.totalExpenses)} icon={<TrendingDown size={18} />} color="#dc2626" />
        <StatCard title="Net Profit / Loss" value={formatINR(reportData.netProfit)} icon={<TrendingUp size={18} />} color={reportData.netProfit >= 0 ? '#16a34a' : '#dc2626'} />
        <StatCard title="Gym Visits Logged" value={reportData.attendanceCount} icon={<Activity size={18} />} color="#7c3aed" />
      </div>

      {/* DETAILED TRANSACTIONS REPORT TABLE */}
      <Card title="Financial Breakdown in Selected Period">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Generating report calculations…</div>
        ) : reportData.paymentsList.length === 0 && reportData.expensesList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No payment or expense records exist in this date range</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] font-extrabold bg-slate-50">
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Title / Member</th>
                  <th className="py-3 px-3">Category / Method</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.paymentsList.map((p) => (
                  <tr key={`p-${p.id}`} className="hover:bg-slate-50">
                    <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">REVENUE</span></td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{formatDateDisplay(p.payment_date)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{p.members?.full_name || 'Member'}</td>
                    <td className="py-3 px-3 uppercase text-xs text-slate-600">{p.payment_method}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">{formatINR(Number(p.amount))}</td>
                  </tr>
                ))}
                {reportData.expensesList.map((e) => (
                  <tr key={`e-${e.id}`} className="hover:bg-slate-50">
                    <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold">EXPENSE</span></td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{formatDateDisplay(e.expense_date)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{e.title}</td>
                    <td className="py-3 px-3 text-xs text-slate-600">{e.category}</td>
                    <td className="py-3 px-3 text-right font-bold text-red-600">-{formatINR(Number(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// 7. PLANS PAGE (FULL MANAGEMENT RESTORED)
// ----------------------------------------------------
export function PlansPage() {
  const [plans, setPlans] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Row | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [description, setDescription] = useState('');
  const [featuresStr, setFeaturesStr] = useState('');

  const loadPlans = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('membership_plans').select('*').order('display_order', { ascending: true });
    setPlans(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleSavePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const client = createBrowserClient();
    if (!client) return;

    const features = featuresStr.split(',').map((f) => f.trim()).filter(Boolean);

    if (editingPlan) {
      await client.from('membership_plans').update({
        name,
        price,
        duration_days: Number(durationDays),
        description,
        features,
      }).eq('id', editingPlan.id);
      await writeAuditLog('EDIT_PLAN', 'membership_plan', editingPlan.id, `Updated plan ${name}`);
    } else {
      await client.from('membership_plans').insert({
        name,
        price,
        duration_days: Number(durationDays),
        description,
        features,
        is_active: true,
        display_order: plans.length + 1,
      });
      await writeAuditLog('CREATE_PLAN', 'membership_plan', undefined, `Created plan ${name}`);
    }

    resetForm();
    setShowAddModal(false);
    setEditingPlan(null);
    loadPlans();
  };

  const handleToggleActive = async (plan: Row) => {
    const client = createBrowserClient();
    if (!client) return;

    await client.from('membership_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    await writeAuditLog('TOGGLE_PLAN_ACTIVE', 'membership_plan', plan.id, `Toggled active to ${!plan.is_active}`);
    loadPlans();
  };

  const openEditModal = (plan: Row) => {
    setEditingPlan(plan);
    setName(plan.name);
    setPrice(plan.price);
    setDurationDays(plan.duration_days || 30);
    setDescription(plan.description || '');
    setFeaturesStr(Array.isArray(plan.features) ? plan.features.join(', ') : '');
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setDurationDays(30);
    setDescription('');
    setFeaturesStr('');
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading membership plans directory…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-slate-900 m-0">Membership Plans Management</h2>
        <button
          onClick={() => {
            resetForm();
            setEditingPlan(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors"
        >
          <Plus size={18} /> Add New Plan
        </button>
      </div>

      <Card title={`Active & Inactive Plans (${plans.length})`}>
        {plans.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No membership plans configured yet</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div key={p.id} className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${p.is_active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-900 text-base m-0">{p.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-red-600">{formatINR(Number(p.price))} <span className="text-xs text-slate-500 font-normal">/ {p.duration_days || 30} days</span></div>
                  <p className="text-xs text-slate-600">{p.description || 'Gym access plan'}</p>
                  {Array.isArray(p.features) && p.features.length > 0 && (
                    <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside pt-1">
                      {p.features.map((feat: string, idx: number) => <li key={idx}>{feat}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                  <button onClick={() => openEditModal(p)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                    Edit
                  </button>
                  <button onClick={() => handleToggleActive(p)} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${p.is_active ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {p.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ADD / EDIT PLAN MODAL */}
      {(showAddModal || editingPlan) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 m-0">{editingPlan ? 'Edit Membership Plan' : 'Create Membership Plan'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingPlan(null); }} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plan Name *</label>
                <input required placeholder="Monthly Strength Plan" value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input type="number" required placeholder="1000" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClassName} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <input type="number" required value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className={inputClassName} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea rows={2} placeholder="Full gym floor access & trainer guidance" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Features (comma separated)</label>
                <input placeholder="Free weight area, Locker access, Cardio zone" value={featuresStr} onChange={(e) => setFeaturesStr(e.target.value)} className={inputClassName} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingPlan(null); }} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm">Save Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 8. ANNOUNCEMENTS PAGE
// ----------------------------------------------------
export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [annType, setAnnType] = useState('General');
  const [priority, setPriority] = useState('medium');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'MEMBER' | 'BOTH'>('BOTH');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    const client = createBrowserClient();
    if (!client) return;

    if (editingId) {
      await client.from('announcements').update({
        title,
        content,
        type: annType,
        priority,
        visibility,
        start_at: startDate || null,
        expires_at: endDate || null,
        image_url: imageUrl || null,
      }).eq('id', editingId);
      await writeAuditLog('EDIT_ANNOUNCEMENT', 'announcement', editingId, `Updated ${title}`);
    } else {
      await client.from('announcements').insert({
        title,
        content,
        type: annType,
        priority,
        visibility,
        start_at: startDate || null,
        expires_at: endDate || null,
        image_url: imageUrl || null,
        is_active: true,
      });
      await writeAuditLog('CREATE_ANNOUNCEMENT', 'announcement', undefined, `Published ${title}`);
    }

    setTitle('');
    setContent('');
    setEndDate('');
    setImageUrl('');
    setVisibility('BOTH');
    setEditingId(null);
    loadData();
  };

  const handleToggleActive = async (a: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    await client.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    const client = createBrowserClient();
    if (!client) return;
    await client.from('announcements').delete().eq('id', id);
    loadData();
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading announcements…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title={`Announcements (${announcements.length})`}>
          {announcements.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No announcements posted yet</div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className={`p-4 rounded-xl border transition-all ${a.is_active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">{a.title}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{a.type || 'General'}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{a.visibility || 'BOTH'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleActive(a)} className={`text-xs font-bold px-2 py-0.5 rounded ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">{a.content}</p>
                  <div className="text-[11px] text-slate-400">
                    Start: {formatDateDisplay(a.start_at)} • Expires: {formatDateDisplay(a.expires_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card title={editingId ? 'Edit Announcement' : 'Post Gym Announcement'}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} placeholder="Happy Independence Day / Offer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category / Type</label>
                <select value={annType} onChange={(e) => setAnnType(e.target.value)} className={inputClassName}>
                  <option value="General">General Notice</option>
                  <option value="Promotion">Promotion / Offer</option>
                  <option value="Festival/Wish">Festival / Wish</option>
                  <option value="Important Notice">Important Notice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Visibility</label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className={inputClassName}>
                  <option value="BOTH">Public & Member Portal</option>
                  <option value="PUBLIC">Public Website Only</option>
                  <option value="MEMBER">Member Portal Only</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Message Content *</label>
              <textarea required rows={3} value={content} onChange={(e) => setContent(e.target.value)} className={inputClassName} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClassName} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">End / Expiry Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClassName} />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors">
              {editingId ? 'Update Announcement' : 'Publish Announcement'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 9. CONTENT PAGE (RESTORED)
// ----------------------------------------------------
export function ContentPage() {
  const [contentRows, setContentRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('hero_title');
  const [value, setValue] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('website_content').select('*').eq('is_active', true);
    setContentRows(data ?? []);
    const match = (data ?? []).find((r) => r.content_key === 'hero_title');
    if (match) setValue(match.content_value || '');
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleKeyChange = (newKey: string) => {
    setKey(newKey);
    const match = contentRows.find((r) => r.content_key === newKey);
    setValue(match ? match.content_value || '' : '');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    await client.from('website_content').upsert(
      { page: 'home', content_key: key, content_value: value, is_active: true },
      { onConflict: 'page,content_key' }
    );

    await writeAuditLog('UPDATE_CONTENT', 'website_content', key, `Updated website content key ${key}`);
    setSavedMsg(`Content '${key}' updated! Public website will reflect changes.`);
    setTimeout(() => setSavedMsg(''), 3000);
    loadData();
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading dynamic website content…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title="Active Website Content Sections">
          {contentRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No custom website content overrides configured</div>
          ) : (
            <div className="space-y-3">
              {contentRows.map((row) => (
                <div key={row.content_key} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-extrabold text-red-600 text-xs uppercase tracking-wider">{row.content_key}</div>
                  <div className="text-xs text-slate-700 leading-relaxed break-words">{row.content_value}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card title="Edit Landing Page Content">
          {savedMsg && <div className="mb-3 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">{savedMsg}</div>}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Content Key</label>
              <select value={key} onChange={(e) => handleKeyChange(e.target.value)} className={inputClassName}>
                <option value="hero_title">Hero Headline Title</option>
                <option value="hero_subtitle">Hero Subtitle</option>
                <option value="hero_cta">Hero CTA Button Text</option>
                <option value="about_title">About Section Title</option>
                <option value="about_description">About Section Description</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Content Value</label>
              <textarea rows={4} required value={value} onChange={(e) => setValue(e.target.value)} className={inputClassName} placeholder="Enter website headline or paragraph..." />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors">
              Save Website Content
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 10. GALLERY PAGE (RESTORED)
// ----------------------------------------------------
export function GalleryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Workouts');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('gallery').select('*').order('display_order', { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !file) return;

    const client = createBrowserClient();
    if (!client) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `gallery_${Date.now()}.${ext}`;

      const { error: uploadErr } = await client.storage.from('member-photos').upload(fileName, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = client.storage.from('member-photos').getPublicUrl(fileName);

      await client.from('gallery').insert({
        title,
        category,
        storage_path: fileName,
        public_url: urlData.publicUrl,
        is_published: true,
        display_order: items.length + 1,
      });

      await writeAuditLog('UPLOAD_GALLERY', 'gallery', undefined, `Uploaded photo ${title}`);
      setTitle('');
      setFile(null);
      loadData();
    } catch (err: any) {
      alert(`Gallery upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: Row) => {
    if (!confirm('Are you sure you want to delete this gallery photo?')) return;
    const client = createBrowserClient();
    if (!client) return;

    if (item.storage_path) {
      await client.storage.from('member-photos').remove([item.storage_path]);
    }
    await client.from('gallery').delete().eq('id', item.id);
    await writeAuditLog('DELETE_GALLERY', 'gallery', item.id, `Deleted photo ${item.title}`);
    loadData();
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">Loading gallery images…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title={`Gallery Photos (${items.length})`}>
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No gallery photos uploaded yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item) => (
                <div key={item.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={item.public_url} alt={item.title} className="w-full h-32 object-cover" />
                  <div className="p-2">
                    <div className="font-bold text-slate-900 text-xs truncate">{item.title}</div>
                    <div className="text-[10px] text-slate-500">{item.category}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(item)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card title="Upload Photo to Gallery">
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} placeholder="Dumbbell Training Area" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClassName} placeholder="Equipment / Workouts" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Image File *</label>
              <input type="file" accept="image/*" required onChange={(e) => setFile(e.target.files?.[0] || null)} className={inputClassName} />
            </div>
            <button type="submit" disabled={uploading} className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors">
              {uploading ? 'Uploading Image…' : 'Upload Gallery Photo'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 11. SOCIAL PAGE (RESTORED)
// ----------------------------------------------------
export function SocialPage() {
  const [platform, setPlatform] = useState('instagram');
  const [url, setUrl] = useState('');
  const [socialRows, setSocialRows] = useState<Row[]>([]);
  const [savedMsg, setSavedMsg] = useState('');

  const loadData = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('social_links').select('*').eq('is_active', true);
    setSocialRows(data ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    await client.from('social_links').upsert({ platform, url, is_active: true }, { onConflict: 'platform' });
    await writeAuditLog('UPDATE_SOCIAL', 'social_links', platform, `Updated ${platform} link`);

    setSavedMsg(`Social link for '${platform}' updated!`);
    setTimeout(() => setSavedMsg(''), 3000);
    setUrl('');
    loadData();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <Card title="Social Links & Handles">
          {socialRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No social media links configured yet</div>
          ) : (
            <div className="space-y-3">
              {socialRows.map((row) => (
                <div key={row.platform} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm capitalize">{row.platform.replace('_', ' ')}</div>
                    <div className="text-xs text-slate-500 font-mono break-all">{row.url || 'Not set'}</div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">ACTIVE</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card title="Update Social Media Link">
          {savedMsg && <div className="mb-3 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">{savedMsg}</div>}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClassName}>
                <option value="instagram">RR Fitness Instagram</option>
                <option value="owner_instagram">Owner Instagram</option>
                <option value="facebook">Facebook Page</option>
                <option value="whatsapp">WhatsApp Contact</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">URL / Phone Number *</label>
              <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/rr_fitness_gym_/" className={inputClassName} />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors">
              Save Social Link
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
  const [businessName, setBusinessName] = useState('RR Fitness');
  const [address, setAddress] = useState('5, Roorkee, Jhabrera, Uttarakhand 247665');
  const [locationRef, setLocationRef] = useState('Ambika Battery');
  const [phone, setPhone] = useState('063967 59176');
  const [whatsapp, setWhatsapp] = useState('916396759176');
  const [hours, setHours] = useState('Open daily until 10 PM');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const loadSettings = async () => {
    const client = createBrowserClient();
    if (!client) return;
    const { data } = await client.from('library_settings').select('*');
    if (data) {
      data.forEach((s) => {
        if (s.setting_key === 'business_name') setBusinessName(s.setting_value);
        if (s.setting_key === 'address') setAddress(s.setting_value);
        if (s.setting_key === 'location_ref') setLocationRef(s.setting_value);
        if (s.setting_key === 'phone_display') setPhone(s.setting_value);
        if (s.setting_key === 'whatsapp_number') setWhatsapp(s.setting_value);
        if (s.setting_key === 'hours') setHours(s.setting_value);
      });
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    setSaving(true);
    const settingsList = [
      { setting_key: 'business_name', setting_value: businessName, is_public: true },
      { setting_key: 'address', setting_value: address, is_public: true },
      { setting_key: 'location_ref', setting_value: locationRef, is_public: true },
      { setting_key: 'phone_display', setting_value: phone, is_public: true },
      { setting_key: 'whatsapp_number', setting_value: whatsapp, is_public: true },
      { setting_key: 'hours', setting_value: hours, is_public: true },
    ];

    for (const item of settingsList) {
      await client.from('library_settings').upsert(item, { onConflict: 'setting_key' });
    }

    await writeAuditLog('UPDATE_SETTINGS', 'settings', undefined, 'Updated gym business settings');
    setSaving(false);
    setSavedMsg('Gym business settings saved successfully!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <Card title="Gym Business Settings">
      {savedMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-bold">{savedMsg}</div>}
      <form onSubmit={handleSave} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Gym Name</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClassName} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClassName} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Location Landmark Reference</label>
          <input value={locationRef} onChange={(e) => setLocationRef(e.target.value)} className={inputClassName} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Display Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClassName} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number (with country code)</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClassName} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Working Hours</label>
          <input value={hours} onChange={(e) => setHours(e.target.value)} className={inputClassName} />
        </div>
        <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition-colors">
          {saving ? 'Saving…' : 'Save Business Settings'}
        </button>
      </form>
    </Card>
  );
}
