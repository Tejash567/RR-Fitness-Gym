import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(baseDate: Date, days: number): Date {
  const result = new Date(baseDate.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized. Auth token missing.' }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized. Invalid session.' }, { status: 401 });
    }

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const planId = body.planId || body.plan_id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return NextResponse.json(
        { error: 'Missing required payment verification parameters.' },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { error: 'Razorpay secret key is not configured on server.' },
        { status: 500 }
      );
    }

    // 1. Verify HMAC SHA-256 signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment signature verification failed. Invalid transaction signature.' },
        { status: 400 }
      );
    }

    // Initialize admin DB client to perform protected updates
    const adminClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // 2. Fetch authenticated member
    const { data: member, error: memberErr } = await adminClient
      .from('members')
      .select('id, full_name, status, start_date, expiry_date, membership_plan_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member profile record not found.' }, { status: 404 });
    }

    if (member.status === 'inactive' || member.status === 'deactivated') {
      return NextResponse.json(
        { error: 'Member account is deactivated by admin.' },
        { status: 403 }
      );
    }

    // 3. Idempotency Check: prevent duplicate payments
    const { data: existingPayment } = await adminClient
      .from('payments')
      .select('id, membership_start_date, membership_end_date')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json({
        success: true,
        message: 'Payment already processed previously.',
        startDate: existingPayment.membership_start_date || member.start_date,
        expiryDate: existingPayment.membership_end_date || member.expiry_date,
      });
    }

    // 4. Fetch plan details from Supabase to prevent client tampering
    const { data: plan, error: planErr } = await adminClient
      .from('membership_plans')
      .select('id, name, price, duration_days, is_active')
      .eq('id', planId)
      .maybeSingle();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Selected membership plan not found.' }, { status: 404 });
    }

    const durationDays = Math.max(1, plan.duration_days || 30);
    const rawPriceStr = String(plan.price || '0').replace(/[^0-9.]/g, '');
    const amountNumeric = parseFloat(rawPriceStr) || 0;

    // 5. Calculate new membership start and expiry dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateISO(today);

    let newStartDate = todayStr;
    let newExpiryDate = formatDateISO(addDays(today, durationDays));

    if (member.expiry_date) {
      const currentExpiry = new Date(member.expiry_date);
      currentExpiry.setHours(0, 0, 0, 0);

      if (currentExpiry >= today) {
        // Active membership renewal: extend from current expiry date
        newStartDate = member.start_date || todayStr;
        newExpiryDate = formatDateISO(addDays(currentExpiry, durationDays));
      } else {
        // Expired membership: set start date to today and add duration
        newStartDate = todayStr;
        newExpiryDate = formatDateISO(addDays(today, durationDays));
      }
    }

    // 6. Update member record to reflect active plan
    const { error: updateMemberErr } = await adminClient
      .from('members')
      .update({
        membership_plan_id: plan.id,
        start_date: newStartDate,
        expiry_date: newExpiryDate,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    if (updateMemberErr) {
      console.error('Failed to update member dates:', updateMemberErr);
      return NextResponse.json(
        { error: `Failed to update membership: ${updateMemberErr.message}` },
        { status: 500 }
      );
    }

    // 7. Create payment record linked to member, plan, and Razorpay transaction IDs
    const paymentPayload = {
      member_id: member.id,
      amount: amountNumeric,
      payment_date: todayStr,
      payment_method: 'razorpay',
      reference: razorpay_payment_id,
      notes: `Razorpay Payment (${plan.name}) | Order ID: ${razorpay_order_id}`,
      membership_plan_id: plan.id,
      membership_start_date: newStartDate,
      membership_end_date: newExpiryDate,
      razorpay_order_id: razorpay_order_id,
      razorpay_payment_id: razorpay_payment_id,
      razorpay_signature: razorpay_signature,
    };

    const { error: insertPaymentErr } = await adminClient.from('payments').insert(paymentPayload);

    if (insertPaymentErr) {
      console.error('Failed to record payment in database:', insertPaymentErr);
      // Note: member updated, but log warning or return error
    }

    return NextResponse.json({
      success: true,
      message: 'Razorpay payment verified and membership successfully updated!',
      startDate: newStartDate,
      expiryDate: newExpiryDate,
      planName: plan.name,
    });
  } catch (err: any) {
    console.error('Error verifying Razorpay payment:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to verify payment.' },
      { status: 500 }
    );
  }
}
