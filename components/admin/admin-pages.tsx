'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb' } as const;

type Row = Record<string, any>;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fffefb', border: '1px solid #d7ded8', borderRadius: 14, padding: 18, boxShadow: '0 10px 20px rgba(24,50,45,0.04)' }}>
      <h3 style={{ margin: '0 0 12px', color: '#18322d' }}>{title}</h3>
      {children}
    </div>
  );
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState({ activeMembers: 0, upcomingExpiries: 0, todayAttendance: 0, activeAnnouncements: 0 });
  const [recentPayments, setRecentPayments] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) {
      setError('Supabase credentials are not configured.');
      return;
    }

    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: membersData }, { data: paymentsData }, { data: attendanceData }, { data: announcementsData }] = await Promise.all([
        client.from('members').select('id,status,expiry_date').eq('status', 'active'),
        client.from('payments').select('id,amount,payment_date').order('payment_date', { ascending: false }).limit(5),
        client.from('attendance').select('id').eq('attendance_date', today),
        client.from('announcements').select('id').eq('is_active', true),
      ]);

      const activeMembers = membersData?.length ?? 0;
      const upcomingExpiries = (membersData ?? []).filter((member) => member.expiry_date && member.expiry_date <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()).length;
      setStats({
        activeMembers,
        upcomingExpiries,
        todayAttendance: attendanceData?.length ?? 0,
        activeAnnouncements: announcementsData?.length ?? 0,
      });
      setRecentPayments(paymentsData ?? []);
    };

    load().catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {error && <div style={{ padding: 12, background: '#fff0e6', borderRadius: 10, color: '#b65d38' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Card title="Active members"><div style={{ fontSize: 28, fontWeight: 700 }}>{stats.activeMembers}</div></Card>
        <Card title="Expiring soon"><div style={{ fontSize: 28, fontWeight: 700 }}>{stats.upcomingExpiries}</div></Card>
        <Card title="Today attendance"><div style={{ fontSize: 28, fontWeight: 700 }}>{stats.todayAttendance}</div></Card>
        <Card title="Active announcements"><div style={{ fontSize: 28, fontWeight: 700 }}>{stats.activeAnnouncements}</div></Card>
      </div>
      <Card title="Recent payments">
        {recentPayments.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentPayments.map((payment) => (
              <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ece7d5', paddingBottom: 8 }}>
                <span>{payment.amount}</span>
                <span style={{ color: '#687671' }}>{payment.payment_date}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#687671' }}>No payment records yet.</div>
        )}
      </Card>
    </div>
  );
}

export function MembersPage() {
  const [members, setMembers] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ id: '', member_id: '', full_name: '', phone: '', email: '', membership_plan_id: '', status: 'active', start_date: '', expiry_date: '', seat_number: '', notes: '' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;

    const load = async () => {
      const [{ data: membersData }, { data: plansData }] = await Promise.all([
        client.from('members').select('id, member_id, full_name, phone, status, expiry_date, start_date').order('created_at', { ascending: false }),
        client.from('membership_plans').select('id, name').eq('is_active', true),
      ]);
      setMembers(membersData ?? []);
      setPlans(plansData ?? []);
    };

    load().catch(() => undefined);
  }, []);

  const filteredMembers = useMemo(() => members.filter((member) => `${member.full_name ?? ''} ${member.phone ?? ''}`.toLowerCase().includes(search.toLowerCase())), [members, search]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;

    const payload = {
      member_id: form.member_id || `MB-${Date.now().toString().slice(-4)}`,
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      membership_plan_id: form.membership_plan_id || null,
      status: form.status,
      start_date: form.start_date || null,
      expiry_date: form.expiry_date || null,
      seat_number: form.seat_number || null,
      notes: form.notes || null,
    };

    if (form.id) {
      const { error } = await client.from('members').update(payload).eq('id', form.id);
      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await client.from('members').insert(payload);
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    const { data } = await client.from('members').select('id, member_id, full_name, phone, status, expiry_date, start_date').order('created_at', { ascending: false });
    setMembers(data ?? []);
    setForm({ id: '', member_id: '', full_name: '', phone: '', email: '', membership_plan_id: '', status: 'active', start_date: '', expiry_date: '', seat_number: '', notes: '' });
    setMessage('Member saved.');
  };

  const handleEdit = (member: Row) => {
    setForm({
      id: member.id,
      member_id: member.member_id ?? '',
      full_name: member.full_name ?? '',
      phone: member.phone ?? '',
      email: member.email ?? '',
      membership_plan_id: member.membership_plan_id ?? '',
      status: member.status ?? 'active',
      start_date: member.start_date ?? '',
      expiry_date: member.expiry_date ?? '',
      seat_number: member.seat_number ?? '',
      notes: member.notes ?? '',
    });
  };

  const handleDeactivate = async (member: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('members').update({ status: 'inactive' }).eq('id', member.id);
    if (!error) {
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, status: 'inactive' } : item));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1.25fr 0.75fr' }}>
        <Card title="Members">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or phone" style={{ ...inputStyle, marginBottom: 12 }} />
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredMembers.map((member) => (
              <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ece7d5', paddingBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{member.full_name}</div>
                  <div style={{ color: '#687671', fontSize: 12 }}>{member.phone} • {member.status}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => handleEdit(member)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>Edit</button>
                  <button type="button" onClick={() => handleDeactivate(member)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d8784c', color: '#d8784c', background: '#fffefb', cursor: 'pointer' }}>Deactivate</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Add or edit member">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })} placeholder="Member ID" style={inputStyle} />
            <input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="Full name" style={inputStyle} />
            <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone" style={inputStyle} />
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" style={inputStyle} />
            <select value={form.membership_plan_id} onChange={(event) => setForm({ ...form, membership_plan_id: event.target.value })} style={inputStyle}>
              <option value="">Select plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} type="date" style={inputStyle} />
              <input value={form.expiry_date} onChange={(event) => setForm({ ...form, expiry_date: event.target.value })} type="date" style={inputStyle} />
            </div>
            <input value={form.seat_number} onChange={(event) => setForm({ ...form, seat_number: event.target.value })} placeholder="Seat number" style={inputStyle} />
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes" rows={3} style={inputStyle} />
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} style={inputStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>Save member</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

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
      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await client.from('membership_plans').insert(payload);
      if (error) {
        setMessage(error.message);
        return;
      }
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
    
    // Check if plan is referenced by members
    const { data: membersData } = await client.from('members').select('id').eq('membership_plan_id', plan.id);
    if (membersData && membersData.length > 0) {
      setMessage('Cannot delete: This plan is assigned to existing members. Consider deactivating it instead.');
      return;
    }

    if (!window.confirm('Delete this membership plan? This action cannot be undone.')) return;
    
    const { error } = await client.from('membership_plans').delete().eq('id', plan.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setPlans((current) => current.filter((p) => p.id !== plan.id));
    setMessage('Plan deleted.');
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Membership plans">
          <div style={{ display: 'grid', gap: 10 }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{plan.name} • {plan.price}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>{plan.description}</div>
                    <div style={{ color: '#687671', fontSize: 12 }}>{plan.is_active ? 'Active' : 'Inactive'}</div>
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
        <Card title="Create or edit plan">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Plan name" style={inputStyle} />
            <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" rows={3} style={inputStyle} />
            <input required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Price" style={inputStyle} />
            <input required value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: event.target.value })} placeholder="Duration (days)" style={inputStyle} />
            <input value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder="Comma separated features" style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
              Active
            </label>
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>{form.id ? 'Update plan' : 'Save plan'}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [form, setForm] = useState({ id: '', member_id: '', amount: '', payment_date: '', payment_method: 'cash', reference: '', notes: '' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    Promise.all([
      client.from('payments').select('*, members(full_name, member_id, status)').order('payment_date', { ascending: false }),
      client.from('members').select('id, full_name, member_id, status').eq('status', 'active').order('created_at', { ascending: false }),
    ]).then(([paymentsRes, membersRes]) => {
      setPayments(paymentsRes.data ?? []);
      setMembers(membersRes.data ?? []);
    });
  }, []);

  const validatePayment = (payload: any) => {
    if (!payload.member_id) return 'Member is required.';
    if (!payload.amount || Number.isNaN(Number(payload.amount)) || Number(payload.amount) <= 0) return 'Enter a valid positive amount.';
    if (!payload.payment_date) return 'Payment date is required.';
    if (!['cash', 'upi', 'bank_transfer', 'other'].includes(payload.payment_method)) return 'Select a valid payment method.';
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    const payload = { member_id: form.member_id, amount: Number(form.amount), payment_date: form.payment_date || new Date().toISOString().slice(0, 10), payment_method: form.payment_method, reference: form.reference || null, notes: form.notes || null };

    const validationError = validatePayment(payload);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (form.id) {
      const { error } = await client.from('payments').update(payload).eq('id', form.id);
      if (error) { setMessage(error.message); return; }
    } else {
      const { error } = await client.from('payments').insert(payload);
      if (error) { setMessage(error.message); return; }
    }

    const { data } = await client.from('payments').select('*, members(full_name, member_id, status)').order('payment_date', { ascending: false });
    setPayments(data ?? []);
    setForm({ id: '', member_id: '', amount: '', payment_date: '', payment_method: 'cash', reference: '', notes: '' });
    setMessage('Payment saved.');
  };

  const handleEdit = (payment: Row) => {
    setForm({ id: payment.id, member_id: payment.member_id ?? '', amount: String(payment.amount ?? ''), payment_date: payment.payment_date ?? '', payment_method: payment.payment_method ?? 'cash', reference: payment.reference ?? '', notes: payment.notes ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (payment: Row) => {
    if (!window.confirm('Delete this payment record? This action cannot be undone.')) return;
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('payments').delete().eq('id', payment.id);
    if (error) { setMessage(error.message); return; }
    setPayments((current) => current.filter((p) => p.id !== payment.id));
    setMessage('Payment deleted.');
  };

  const findMemberLabel = (payment: Row) => {
    if (payment.members && payment.members.full_name) {
      return `${payment.members.full_name}${payment.members.member_id ? ` (ID: ${payment.members.member_id})` : ''}`;
    }
    // Fallback to local members array
    const m = members.find((x) => x.id === payment.member_id);
    if (!m) return 'Unknown member';
    return `${m.full_name}${m.member_id ? ` (ID: ${m.member_id})` : ''}`;
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Payment records">
          <div style={{ display: 'grid', gap: 10 }}>
            {payments.map((payment) => (
              <div key={payment.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{payment.amount} • {payment.payment_method}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>{payment.payment_date} • {payment.reference || 'No reference'}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>Member: {findMemberLabel(payment)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleEdit(payment)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(payment)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d8784c', color: '#d8784c', background: '#fffefb', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Record a payment">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <select required value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })} style={inputStyle}>
              <option value="">Select member</option>
              {members.filter((m) => m.status === 'active').map((member) => <option key={member.id} value={member.id}>{member.full_name}{member.member_id ? ` (ID: ${member.member_id})` : ''}</option>)}
            </select>
            <input required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Amount" style={inputStyle} />
            <input required value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} type="date" style={inputStyle} />
            <select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} style={inputStyle}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
            <input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Reference / transaction ID" style={inputStyle} />
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes" rows={3} style={inputStyle} />
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>{form.id ? 'Update payment' : 'Save payment'}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function AttendancePage() {
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [form, setForm] = useState({ member_id: '', attendance_date: '', entry_time: '', exit_time: '' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;
    Promise.all([
      client.from('attendance').select('*, members(full_name, member_id)').order('attendance_date', { ascending: false }).limit(10),
      client.from('members').select('id, full_name, member_id, status').eq('status', 'active').order('created_at', { ascending: false }),
    ]).then(([attendanceRes, membersRes]) => {
      setAttendance(attendanceRes.data ?? []);
      setMembers(membersRes.data ?? []);
    });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createBrowserClient();
    if (!client) return;
    if (!form.member_id) { 
      setMessage('Please select a member');
      return;
    }
    const payload = { member_id: form.member_id, attendance_date: form.attendance_date || new Date().toISOString().slice(0, 10), entry_time: form.entry_time || null, exit_time: form.exit_time || null };
    const { error } = await client.from('attendance').insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }
    const { data } = await client.from('attendance').select('*, members(full_name, member_id)').order('attendance_date', { ascending: false }).limit(10);
    setAttendance(data ?? []);
    setForm({ member_id: '', attendance_date: '', entry_time: '', exit_time: '' });
    setMessage('Attendance recorded.');
  };

  const memberLabel = (member: Row) => `${member.full_name}${member.member_id ? ` (ID: ${member.member_id})` : ''}`;

  const getMemberName = (item: Row) => {
    if (item.members && item.members.full_name) {
      return `${item.members.full_name}${item.members.member_id ? ` (ID: ${item.members.member_id})` : ''}`;
    }
    return 'Unknown member';
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Attendance history">
          <div style={{ display: 'grid', gap: 10 }}>
            {attendance.map((item) => (
              <div key={item.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{item.attendance_date}</div>
                <div style={{ color: '#687671', fontSize: 13 }}>{getMemberName(item)}</div>
                <div style={{ color: '#687671', fontSize: 12 }}>{item.entry_time || '—'} • {item.exit_time || '—'}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Mark member present">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <select required value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })} style={inputStyle}>
              <option value="">Select member</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.full_name}{member.member_id ? ` (ID: ${member.member_id})` : ''}</option>)}
            </select>
            <input value={form.attendance_date} onChange={(event) => setForm({ ...form, attendance_date: event.target.value })} type="date" style={inputStyle} />
            <input value={form.entry_time} onChange={(event) => setForm({ ...form, entry_time: event.target.value })} type="time" style={inputStyle} />
            <input value={form.exit_time} onChange={(event) => setForm({ ...form, exit_time: event.target.value })} type="time" style={inputStyle} />
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>Save attendance</button>
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
      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await client.from('announcements').insert(payload);
      if (error) {
        setMessage(error.message);
        return;
      }
    }
    const { data } = await client.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data ?? []);
    setForm({ id: '', title: '', content: '', is_active: true, start_at: '', expires_at: '' });
    setMessage('Announcement saved.');
  };

  const handleEdit = (item: Row) => {
    setForm({
      id: item.id,
      title: item.title ?? '',
      content: item.content ?? '',
      is_active: item.is_active ?? true,
      start_at: item.start_at ?? '',
      expires_at: item.expires_at ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item: Row) => {
    if (!window.confirm('Delete this announcement? This action cannot be undone.')) return;
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('announcements').delete().eq('id', item.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setAnnouncements((current) => current.filter((a) => a.id !== item.id));
    setMessage('Announcement deleted.');
  };

  const handleToggleActive = async (item: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('announcements').update({ is_active: !item.is_active }).eq('id', item.id);
    if (!error) {
      setAnnouncements((current) => current.map((a) => a.id === item.id ? { ...a, is_active: !a.is_active } : a));
    }
  };

  const isExpired = (item: Row) => {
    if (!item.expires_at) return false;
    return new Date(item.expires_at) < new Date();
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Announcements">
          <div style={{ display: 'grid', gap: 10 }}>
            {announcements.map((item) => (
              <div key={item.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>{item.content}</div>
                    <div style={{ color: '#687671', fontSize: 12 }}>
                      {item.is_active ? 'Active' : 'Inactive'} 
                      {isExpired(item) && ' (Expired)'}
                      {item.start_at && ` • Starts: ${item.start_at}`}
                      {item.expires_at && ` • Expires: ${item.expires_at}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleToggleActive(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>
                      {item.is_active ? 'Archive' : 'Activate'}
                    </button>
                    <button type="button" onClick={() => handleEdit(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d8784c', color: '#d8784c', background: '#fffefb', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Create or edit announcement">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" style={inputStyle} />
            <textarea required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Content" rows={4} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
              Active
            </label>
            <input value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} type="date" style={inputStyle} placeholder="Start date" />
            <input value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} type="date" style={inputStyle} placeholder="Expiry date" />
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>{form.id ? 'Update announcement' : 'Save announcement'}</button>
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
    ['contact_description', 'Find us at 5, Roorkee, Jhabrera, Uttarakhand 247665 (Near Ambika Battery). Open until 10 PM.'],
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
    <Card title="Editable website content">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <select value={selectedKey} onChange={(event) => { setSelectedKey(event.target.value); const current = rows.find((row) => row.content_key === event.target.value); setValue(current?.content_value ?? ''); }} style={inputStyle}>
          {defaults.map(([key, defaultValue]) => <option key={key} value={key}>{key}</option>)}
        </select>
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} style={inputStyle} />
        <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>Save content</button>
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

    // Upload new file if provided
    if (file) {
      const path = `gallery/${Date.now()}-${file.name}`;
      const { error: uploadError } = await client.storage.from('library-gallery').upload(path, file, { upsert: true });
      if (uploadError) {
        setMessage(`Upload failed: ${uploadError.message}`);
        return;
      }
      const { data: publicData } = client.storage.from('library-gallery').getPublicUrl(path);
      storagePath = path;
      publicUrl = publicData.publicUrl;
    }

    const payload = { 
      title: form.title, 
      category: form.category, 
      alt_text: form.alt_text, 
      storage_path: storagePath, 
      public_url: publicUrl, 
      is_published: form.is_published,
      display_order: form.id ? items.find(i => i.id === form.id)?.display_order ?? items.length + 1 : items.length + 1 
    };

    if (form.id) {
      const { error } = await client.from('gallery').update(payload).eq('id', form.id);
      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      if (!file) {
        setMessage('Please select a file to upload.');
        return;
      }
      const { error } = await client.from('gallery').insert(payload);
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    const { data } = await client.from('gallery').select('*').order('display_order', { ascending: true });
    setItems(data ?? []);
    setForm({ id: '', title: '', category: '', alt_text: '', is_published: true, storage_path: '', public_url: '' });
    setFile(null);
    setMessage('Gallery item saved.');
  };

  const handleEdit = (item: Row) => {
    setForm({
      id: item.id,
      title: item.title ?? '',
      category: item.category ?? '',
      alt_text: item.alt_text ?? '',
      is_published: item.is_published ?? true,
      storage_path: item.storage_path ?? '',
      public_url: item.public_url ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item: Row) => {
    if (!window.confirm('Delete this gallery item? This action cannot be undone.')) return;
    const client = createBrowserClient();
    if (!client) return;

    // Delete from storage
    if (item.storage_path) {
      await client.storage.from('library-gallery').remove([item.storage_path]);
    }

    const { error } = await client.from('gallery').delete().eq('id', item.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setItems((current) => current.filter((i) => i.id !== item.id));
    setMessage('Gallery item deleted.');
  };

  const handleTogglePublish = async (item: Row) => {
    const client = createBrowserClient();
    if (!client) return;
    const { error } = await client.from('gallery').update({ is_published: !item.is_published }).eq('id', item.id);
    if (!error) {
      setItems((current) => current.map((i) => i.id === item.id ? { ...i, is_published: !i.is_published } : i));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ padding: 12, borderRadius: 10, background: '#eef7f0', color: '#2f6043' }}>{message}</div>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 0.8fr' }}>
        <Card title="Gallery items">
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: '#687671', fontSize: 13 }}>{item.category}</div>
                    <div style={{ color: '#687671', fontSize: 12 }}>
                      {item.is_published ? 'Published' : 'Unpublished'}
                      {item.storage_path && ` • ${item.storage_path}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleTogglePublish(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>
                      {item.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button type="button" onClick={() => handleEdit(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d7ded8', background: '#fffefb', cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d8784c', color: '#d8784c', background: '#fffefb', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Upload or edit gallery item">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" style={inputStyle} />
            <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Category" style={inputStyle} />
            <input value={form.alt_text} onChange={(event) => setForm({ ...form, alt_text: event.target.value })} placeholder="Alt text" style={inputStyle} />
            <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} type="checkbox" />
              Published
            </label>
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>{form.id ? 'Update item' : 'Upload'}</button>
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
      <Card title="Social links">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.platform} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{row.platform}</div>
              <div style={{ color: '#687671', fontSize: 13 }}>{row.url}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Update a social link">
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} style={inputStyle}>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Link" style={inputStyle} />
          <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>Save</button>
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
      <Card title="Gym settings">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.setting_key} style={{ borderBottom: '1px solid #ece7d5', paddingBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{row.setting_key}</div>
              <div style={{ color: '#687671', fontSize: 13 }}>{row.setting_value}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Edit a setting">
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
          <select value={key} onChange={(event) => setKey(event.target.value)} style={inputStyle}>
            <option value="address">Address</option>
            <option value="hours">Hours</option>
            <option value="phone_display">Phone</option>
            <option value="directions_url">Directions URL</option>
            <option value="whatsapp_number">WhatsApp Number</option>
          </select>
          <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} style={inputStyle} />
          <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#d8784c', color: 'white', cursor: 'pointer' }}>Save</button>
        </form>
      </Card>
    </div>
  );
}
