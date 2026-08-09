import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { siteConfig } from '@/lib/site-config';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://rrfitness.in'),
  title: 'RR Fitness | Gym & Fitness Centre in Jhabrera, Uttarakhand',
  description: 'RR Fitness in Jhabrera, Uttarakhand. Train Hard. Stay Strong. Modern fitness destination offering quality workout equipment and dumbbell area. Open until 10 PM.',
  keywords: ['RR Fitness', 'gym Jhabrera', 'fitness centre Jhabrera', 'workout gym Roorkee Jhabrera', 'RR Fitness gym Jhabrera'],
  openGraph: {
    title: 'RR FITNESS | Train Hard. Stay Strong.',
    description: 'A modern fitness destination in Jhabrera, Uttarakhand. Equipments, dumbbell training area, open until 10 PM.',
    type: 'website',
  },
  icons: {
    icon: '/images/rr-fitness-logo.jpg',
    apple: '/images/rr-fitness-logo.jpg',
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'ExerciseGym',
  name: siteConfig.name,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '5, Roorkee, Jhabrera',
    addressLocality: 'Jhabrera',
    addressRegion: 'Uttarakhand',
    postalCode: '247665',
    addressCountry: 'IN',
  },
  telephone: `+${siteConfig.phoneDigits}`,
  openingHours: 'Mo-Su 06:00-22:00',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  );
}

