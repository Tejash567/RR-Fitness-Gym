import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
    const planId = body.planId || body.plan_id;

    if (!planId) {
      return NextResponse.json({ error: 'Membership plan ID is required.' }, { status: 400 });
    }

    // Lookup member linked to this auth user
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : authClient;

    const { data: member, error: memberErr } = await dbClient
      .from('members')
      .select('id, full_name, email, phone, status')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member profile not found.' }, { status: 404 });
    }

    if (member.status === 'inactive' || member.status === 'deactivated') {
      return NextResponse.json(
        { error: 'Your member account is deactivated. Payments are disabled.' },
        { status: 403 }
      );
    }

    // Lookup membership plan from DB to enforce authoritative pricing
    const { data: plan, error: planErr } = await dbClient
      .from('membership_plans')
      .select('id, name, price, duration_days, is_active')
      .eq('id', planId)
      .maybeSingle();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Selected membership plan not found.' }, { status: 404 });
    }

    if (!plan.is_active) {
      return NextResponse.json({ error: 'Selected plan is not currently active.' }, { status: 400 });
    }

    const rawPriceStr = String(plan.price || '0').replace(/[^0-9.]/g, '');
    const priceNumeric = parseFloat(rawPriceStr);

    if (isNaN(priceNumeric) || priceNumeric <= 0) {
      return NextResponse.json({ error: 'Invalid plan price configured.' }, { status: 400 });
    }

    const amountInPaise = Math.round(priceNumeric * 100);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId === 'rzp_test_placeholder') {
      return NextResponse.json(
        {
          error:
            'Razorpay credentials are not configured. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.',
        },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const receiptId = `rcpt_${member.id.slice(0, 8)}_${Date.now()}`;
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        member_id: member.id,
        plan_id: plan.id,
        plan_name: plan.name,
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: keyId,
      planName: plan.name,
      memberName: member.full_name,
      memberEmail: member.email,
      memberPhone: member.phone,
    });
  } catch (err: any) {
    console.error('Error creating Razorpay order:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create Razorpay order.' },
      { status: 500 }
    );
  }
}
