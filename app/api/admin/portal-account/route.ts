import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSyntheticEmail(memberCode: string | null, id: string): string {
  const cleanCode = (memberCode || id).trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `member_${cleanCode}@rrfitness.com`;
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, memberId, password, status } = body;

    if (!memberId || !action) {
      return NextResponse.json({ error: 'Member identifier and action are required.' }, { status: 400 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json({
        error: 'SUPABASE_SERVICE_ROLE_KEY environment variable is not configured. Server-side portal credential creation requires SUPABASE_SERVICE_ROLE_KEY in .env file.'
      }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Step 1: Find member from members table
    let member = null;
    if (isValidUUID(memberId)) {
      const { data } = await adminClient
        .from('members')
        .select('id, full_name, member_code, member_id, user_id, email, status')
        .eq('id', memberId)
        .maybeSingle();
      member = data;
    }

    if (!member) {
      const { data } = await adminClient
        .from('members')
        .select('id, full_name, member_code, member_id, user_id, email, status')
        .or(`member_code.ilike.${memberId},member_id.ilike.${memberId}`)
        .maybeSingle();
      member = data;
    }

    if (!member) {
      return NextResponse.json({ error: 'Member record not found in database.' }, { status: 404 });
    }

    if (action === 'create' || action === 'reset_password') {
      if (!password || String(password).length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const targetEmail = member.email || getSyntheticEmail(member.member_code || member.member_id, member.id);
      let userId: string | null = null;

      // Case A: members.user_id already exists
      if (member.user_id) {
        const { data: userRes } = await adminClient.auth.admin.getUserById(member.user_id);
        if (userRes?.user) {
          // Reset/update password on existing Auth user - NO new Auth user created!
          const { error: resetErr } = await adminClient.auth.admin.updateUserById(member.user_id, {
            password: String(password),
          });
          if (resetErr) {
            return NextResponse.json({ error: resetErr.message }, { status: 400 });
          }
          userId = member.user_id;
        }
      }

      // Case B: members.user_id is NULL or broken link - check if Auth user with targetEmail already exists
      if (!userId) {
        const { data: listRes } = await adminClient.auth.admin.listUsers();
        const existingUser = listRes?.users?.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());

        if (existingUser) {
          // Existing Auth user found - reset/update password securely
          userId = existingUser.id;
          const { error: resetErr } = await adminClient.auth.admin.updateUserById(userId, {
            password: String(password),
          });
          if (resetErr) {
            return NextResponse.json({ error: resetErr.message }, { status: 400 });
          }
        } else {
          // Create EXACTLY ONE new confirmed Auth user via auth.admin.createUser
          const { data: newUserRes, error: createErr } = await adminClient.auth.admin.createUser({
            email: targetEmail,
            password: String(password),
            email_confirm: true,
            user_metadata: {
              member_id: member.id,
              member_code: member.member_code || member.member_id,
              full_name: member.full_name,
            },
          });

          if (createErr || !newUserRes?.user) {
            return NextResponse.json({ error: createErr?.message || 'Failed to create Supabase Auth user.' }, { status: 400 });
          }
          userId = newUserRes.user.id;
        }
      }

      if (!userId) {
        return NextResponse.json({ error: 'Could not obtain valid Auth user ID from Supabase Auth.' }, { status: 400 });
      }

      // ONLY AFTER Auth user exists in auth.users, update members.user_id
      const { error: linkErr } = await adminClient
        .from('members')
        .update({
          user_id: userId,
          email: targetEmail,
          status: 'active',
        })
        .eq('id', member.id);

      if (linkErr) {
        return NextResponse.json({ error: `Failed to link user_id: ${linkErr.message}` }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Portal credentials generated & linked successfully.',
        memberCode: member.member_code || member.member_id || member.id,
        password: String(password),
        userId,
      });
    } else if (action === 'toggle_status') {
      const newStatus = status || (member.status === 'inactive' ? 'active' : 'inactive');
      const { error: toggleErr } = await adminClient
        .from('members')
        .update({ status: newStatus })
        .eq('id', member.id);

      if (toggleErr) {
        return NextResponse.json({ error: toggleErr.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, status: newStatus });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error processing request.' }, { status: 500 });
  }
}
