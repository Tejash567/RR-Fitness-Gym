import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fa', color: '#0f0f11', padding: 24, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 48, margin: '0 0 12px', fontWeight: 900, color: '#dc2626' }}>404</h1>
        <h2 style={{ fontSize: 24, margin: '0 0 16px', fontWeight: 800 }}>Page Not Found</h2>
        <p style={{ color: '#52525b', marginBottom: 24 }}>The page you are looking for does not exist or has been moved.</p>
        <Link href="/" style={{ display: 'inline-flex', padding: '12px 20px', background: '#dc2626', color: 'white', borderRadius: 4, fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Back to RR Fitness Home
        </Link>
      </div>
    </div>
  );
}
