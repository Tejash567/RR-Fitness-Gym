export type Announcement = {
  id: string;
  title: string;
  content: string;
  active: boolean;
  startDate: string;
  expiryDate: string;
  createdDate: string;
};

export type Facility = {
  id: string;
  icon: 'dumbbells' | 'equipment' | 'space' | 'clock';
  title: string;
  description: string;
};

export type MembershipPlan = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  featured: boolean;
};

export type GalleryItem = {
  id: string;
  image: string;
  title: string;
  category: string;
  alt: string;
  displayOrder: number;
};

export type SocialLinks = {
  instagramUrl: string;
  ownerInstagramUrl?: string;
  facebookUrl: string;
  whatsappNumber: string;
};

export type LibraryConfig = {
  name: string;
  shortName: string;
  logoPath: string;
  address: string;
  addressShort: string;
  locationRef: string;
  phoneDisplay: string;
  phoneDigits: string;
  hours: string;
  rating: string;
  reviewCount: string;
  directionsUrl: string;
  socialLinks: SocialLinks;
};

export type WebsiteContentMap = Record<string, string>;

export type PublicSiteData = {
  announcements: Announcement[];
  facilities: Facility[];
  membershipPlans: MembershipPlan[];
  galleryItems: GalleryItem[];
  socialLinks: SocialLinks;
  libraryConfig: LibraryConfig;
  websiteContent: WebsiteContentMap;
  settings: Record<string, string>;
};

export const siteConfig: LibraryConfig = {
  name: 'RR Fitness',
  shortName: 'RR Fitness',
  logoPath: '/images/rr-fitness-logo.jpg',
  address: '5, Roorkee, Jhabrera, Uttarakhand 247665',
  addressShort: '5, Roorkee, Jhabrera, Uttarakhand 247665',
  locationRef: 'Ambika Battery',
  phoneDisplay: '063967 59176',
  phoneDigits: '916396759176',
  hours: 'Open until 10 PM',
  rating: '4.9',
  reviewCount: 'RR Fitness Jhabrera',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('RR Fitness, 5, Roorkee, Jhabrera, Uttarakhand 247665'),
  socialLinks: {
    instagramUrl: 'https://www.instagram.com/rr_fitness_gym_/',
    ownerInstagramUrl: 'https://www.instagram.com/chaudhary_himanshu_ross/',
    facebookUrl: '',
    whatsappNumber: '916396759176',
  } as SocialLinks,
};

// Export libraryConfig alias to preserve backwards compatibility across components
export const libraryConfig = siteConfig;

export const announcements: Announcement[] = [];

export const facilities: Facility[] = [
  {
    id: 'dumbbells',
    icon: 'dumbbells',
    title: 'Dumbbell & Free Weights Area',
    description: 'Dedicated dumbbell racks and free weight training zone for strength building.',
  },
  {
    id: 'equipment',
    icon: 'equipment',
    title: 'Modern Workout Equipment',
    description: 'Comprehensive fitness machines and equipment for all workout routines.',
  },
  {
    id: 'space',
    icon: 'space',
    title: 'Spacious Training Floor',
    description: 'Clean, open workout environment designed for comfortable daily exercise.',
  },
  {
    id: 'clock',
    icon: 'clock',
    title: 'Convenient Working Hours',
    description: 'Open daily until 10 PM to accommodate your daily workout schedule.',
  },
];

export const membershipPlans: MembershipPlan[] = [];

export const galleryItems: GalleryItem[] = [];

export const whatsappMessages = {
  general: 'Hello, I would like to know more about RR Fitness.',
  membership: 'Hello, I am interested in joining RR Fitness. Please share the membership details.',
} as const;

export function buildDefaultPublicSiteData(): PublicSiteData {
  return {
    announcements: [],
    facilities,
    membershipPlans: [],
    galleryItems: [],
    socialLinks: { ...siteConfig.socialLinks },
    libraryConfig: { ...siteConfig },
    websiteContent: {},
    settings: {
      address: siteConfig.address,
      hours: siteConfig.hours,
      whatsapp_number: siteConfig.socialLinks.whatsappNumber,
      directions_url: siteConfig.directionsUrl,
    },
  };
}

export function getWhatsAppUrl(message: string): string {
  return `https://wa.me/${libraryConfig.phoneDigits}?text=${encodeURIComponent(message)}`;
}
