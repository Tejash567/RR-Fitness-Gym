'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // If the user is already signed in, check their profile role.
    const checkAuth = async () => {
      if (!isSupabaseConfigured()) return;
      const client = createBrowserClient();
      if (!client) return;

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) return;

      // user is authenticated; check profile role
      const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
      if (profileError) {
        setMessage('Unable to verify account role.');
        return;
      }

      if (profile && profile.role === 'admin') {
        // already an admin — redirect to /admin
        router.replace('/admin');
        return;
      }

      if (profile && profile.role !== 'admin') {
        setMessage('Authenticated but not authorized to access the admin dashboard.');
      }
    };

    checkAuth().catch(() => undefined);
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setMessage('Supabase is not configured yet.');
      return;
    }

    const client = createBrowserClient();
    if (!client) {
      setMessage('Supabase client unavailable.');
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }

    // After sign-in, check profile role before redirecting
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) {
      setMessage('Sign-in succeeded but user session could not be retrieved.');
      return;
    }

    const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    if (profileError || !profile) {
      setMessage('Signed in but no profile found. Contact the site administrator.');
      return;
    }

    if (profile.role !== 'admin') {
      setMessage('Signed in but not authorized as admin.');
      return;
    }

    router.replace('/admin');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fa', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#ffffff', borderRadius: 18, border: '1px solid #e4e4e7', padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <img src="/images/rr-fitness-logo.jpg" alt="RR Fitness logo" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #dc2626', objectFit: 'cover' }} />
          <div>
            <h1 style={{ margin: 0, color: '#0f0f11', fontSize: 22, fontWeight: 900, textTransform: 'uppercase' }}>RR Fitness Admin</h1>
            <p style={{ margin: 0, color: '#52525b', fontSize: 13 }}>Sign in with your authorized admin account.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email address" style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 14 }} />
          <input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 14 }} />
          <button type="submit" style={{ padding: '12px 14px', borderRadius: 8, border: 0, background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Sign In</button>
        </form>
        {message ? <p style={{ color: '#dc2626', marginTop: 14, fontSize: 13, fontWeight: 600 }}>{message}</p> : null}
      </div>
    </div>
  );
}

