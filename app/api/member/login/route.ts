import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSyntheticEmail(memberCode: string | null, id: string): string {
  const cleanCode = (memberCode || id).trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `member_${cleanCode}@rrfitness.com`;
}

export async function POST(request: Request) {
  try {
    const { memberCode, password } = await request.json();

    if (!memberCode || !password) {
      return NextResponse.json({ error: 'Member ID and password are required.' }, { status: 400 });
    }

    const cleanCode = String(memberCode).trim();
    if (!cleanCode) {
      return NextResponse.json({ error: 'Member ID and password are required.' }, { status: 400 });
    }

    // Server-side lookup using service role client or anon client
    const serverClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    const { data: member, error: memberErr } = await serverClient
      .from('members')
      .select('id, member_code, member_id, user_id, email, status')
      .or(`member_code.ilike.${cleanCode},member_id.ilike.${cleanCode}`)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Invalid Member ID or password.' }, { status: 400 });
    }

    if (member.status === 'inactive' || member.status === 'deactivated') {
      return NextResponse.json({ error: 'Your member account is currently disabled. Please contact gym administration.' }, { status: 403 });
    }

    // Determine target email for Auth sign-in
    let email = member.email;
    if (!email && member.user_id && serviceRoleKey) {
      const { data: userRes } = await serverClient.auth.admin.getUserById(member.user_id);
      if (userRes?.user?.email) {
        email = userRes.user.email;
      }
    }
    if (!email) {
      email = getSyntheticEmail(member.member_code || member.member_id, member.id);
    }

    // Authenticate with Supabase Auth using target email & provided password
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email,
      password: String(password),
    });

    if (authErr || !authData.session) {
      return NextResponse.json({ error: 'Invalid Member ID or password.' }, { status: 400 });
    }

    return NextResponse.json({
      session: authData.session,
      user: authData.user,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid Member ID or password.' }, { status: 400 });
  }
}
