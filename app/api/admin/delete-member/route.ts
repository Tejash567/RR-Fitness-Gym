import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, confirmCode } = body;

    if (!memberId || !isValidUUID(memberId)) {
      return NextResponse.json({ error: 'Valid member UUID is required.' }, { status: 400 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json({
        error: 'SUPABASE_SERVICE_ROLE_KEY environment variable is not configured. Permanent deletion requires server-side service role execution.'
      }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch target member details
    const { data: member, error: fetchErr } = await adminClient
      .from('members')
      .select('id, full_name, member_code, user_id, photo_storage_path')
      .eq('id', memberId)
      .maybeSingle();

    if (fetchErr || !member) {
      return NextResponse.json({ error: 'Member record not found in database.' }, { status: 404 });
    }

    // 2. Validate confirmation code matches member_code or ID prefix
    const expectedCode = (member.member_code || member.id).trim();
    if (confirmCode && confirmCode.trim().toLowerCase() !== expectedCode.toLowerCase()) {
      return NextResponse.json({ error: `Confirmation code mismatch. Expected '${expectedCode}'.` }, { status: 400 });
    }

    const memberName = member.full_name;
    const memberCode = member.member_code || member.id;

    // 3. Remove photo object from Supabase Storage if path exists
    if (member.photo_storage_path) {
      try {
        await adminClient.storage.from('member-photos').remove([member.photo_storage_path]);
      } catch (e) {
        // Storage cleanup non-blocking catch
      }
    }

    // 4. Delete linked Supabase Auth user if present
    if (member.user_id) {
      try {
        await adminClient.auth.admin.deleteUser(member.user_id);
      } catch (e) {
        // Auth user deletion non-blocking catch
      }
    }

    // 5. Delete dependent records cleanly
    await Promise.all([
      adminClient.from('payments').delete().eq('member_id', memberId),
      adminClient.from('attendance').delete().eq('member_id', memberId),
      adminClient.from('membership_adjustments').delete().eq('member_id', memberId),
      adminClient.from('extra_charges').delete().eq('member_id', memberId),
    ]);

    // 6. Record audit log before member table delete (user_id = null, details contain record history)
    await adminClient.from('audit_logs').insert({
      user_id: null,
      user_email: 'admin',
      action: 'PERMANENT_DELETE_MEMBER',
      entity: 'member',
      entity_id: null,
      details: `Permanently deleted member ${memberName} (${memberCode}) and all linked auth credentials and records.`,
    });

    // 7. Permanently delete member row
    const { error: deleteErr } = await adminClient
      .from('members')
      .delete()
      .eq('id', memberId);

    if (deleteErr) {
      return NextResponse.json({ error: `Failed to delete member row: ${deleteErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Member ${memberName} (${memberCode}) has been permanently deleted from the database.`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error during permanent member deletion.' }, { status: 500 });
  }
}
