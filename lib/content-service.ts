import { type Announcement, type Facility, type GalleryItem, type MembershipPlan, type PublicSiteData, type SocialLinks, libraryConfig } from './site-config';
import { createBrowserClient } from './supabase';

function mapContentRows(rows: Array<{ content_key?: string; content_value?: string }> | null | undefined) {
  return (rows ?? []).reduce<Record<string, string>>((acc, row) => {
    if (row.content_key && typeof row.content_value === 'string') {
      acc[row.content_key] = row.content_value;
    }
    return acc;
  }, {});
}

function mapSettingsRows(rows: Array<{ setting_key?: string; setting_value?: string }> | null | undefined) {
  return (rows ?? []).reduce<Record<string, string>>((acc, row) => {
    if (row.setting_key && typeof row.setting_value === 'string') {
      acc[row.setting_key] = row.setting_value;
    }
    return acc;
  }, {});
}

function mapSocialRows(rows: Array<{ platform?: string; url?: string }> | null | undefined) {
  return (rows ?? []).reduce<Record<string, string>>((acc, row) => {
    if (row.platform && typeof row.url === 'string') {
      acc[row.platform] = row.url;
    }
    return acc;
  }, {});
}

function normalizeAnnouncements(rows: Array<any> | null | undefined): Announcement[] {
  const now = new Date();
  return (rows ?? [])
    .map((row) => ({
      id: row.id,
      title: row.title ?? '',
      content: row.content ?? '',
      active: Boolean(row.is_active ?? row.active),
      startDate: row.start_at ?? row.startDate ?? '',
      expiryDate: row.expires_at ?? row.expiryDate ?? '',
      createdDate: row.created_at ?? row.createdDate ?? '',
    }))
    .filter((announcement) => {
      // Filter out expired announcements for public display
      if (announcement.expiryDate) {
        const expiryDate = new Date(announcement.expiryDate);
        if (expiryDate < now) {
          return false;
        }
      }
      // Check start date
      if (announcement.startDate) {
        const startDate = new Date(announcement.startDate);
        if (startDate > now) {
          return false;
        }
      }
      return announcement.active;
    });
}

function normalizeFacilities(rows: Array<any> | null | undefined): Facility[] {
  return [
    {
      id: 'static-1',
      icon: 'dumbbells' as Facility['icon'],
      title: 'Dumbbell & Free Weights Area',
      description: 'Dedicated dumbbell racks and weight area for strength training.',
    },
    {
      id: 'static-2',
      icon: 'equipment' as Facility['icon'],
      title: 'Modern Workout Equipment',
      description: 'Comprehensive fitness gear and machines for daily workouts.',
    },
    {
      id: 'static-3',
      icon: 'space' as Facility['icon'],
      title: 'Spacious Training Floor',
      description: 'Clean and open training environment for peak performance.',
    },
    {
      id: 'static-4',
      icon: 'clock' as Facility['icon'],
      title: 'Convenient Working Hours',
      description: 'Open daily until 10 PM for flexible workout schedules.',
    },
  ];
}

function normalizeMembershipPlans(rows: Array<any> | null | undefined): MembershipPlan[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? '',
    price: row.price ?? '',
    description: row.description ?? '',
    features: Array.isArray(row.features) ? row.features : [],
    featured: Boolean(row.is_featured ?? row.featured),
  }));
}

function normalizeGallery(rows: Array<any> | null | undefined): GalleryItem[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    image: row.public_url ?? row.image ?? '',
    title: row.title ?? '',
    category: row.category ?? 'Gallery',
    alt: row.alt_text ?? row.alt ?? '',
    displayOrder: Number(row.display_order ?? 0),
  }));
}

function emptyPublicData(): PublicSiteData {
  return {
    announcements: [],
    facilities: normalizeFacilities([]),
    membershipPlans: [],
    galleryItems: [],
    socialLinks: {
      instagramUrl: libraryConfig.socialLinks.instagramUrl || '',
      ownerInstagramUrl: libraryConfig.socialLinks.ownerInstagramUrl || '',
      facebookUrl: libraryConfig.socialLinks.facebookUrl || '',
      whatsappNumber: libraryConfig.socialLinks.whatsappNumber || '',
    },
    libraryConfig: { ...libraryConfig },
    websiteContent: {},
    settings: {},
  };
}

export async function loadPublicSiteData(): Promise<PublicSiteData> {
  const client = createBrowserClient();
  if (!client) {
    return emptyPublicData();
  }

  try {
    const [announcementsRes, facilitiesRes, plansRes, galleryRes, contentRes, settingsRes, socialRes] = await Promise.all([
      client.from('announcements').select('*').eq('is_active', true),
      client.from('facilities').select('*').eq('is_active', true).order('display_order', { ascending: true }),
      client.from('membership_plans').select('*').eq('is_active', true).order('display_order', { ascending: true }),
      client.from('gallery').select('*').eq('is_published', true).order('display_order', { ascending: true }),
      client.from('website_content').select('content_key, content_value').eq('is_active', true),
      client.from('library_settings').select('setting_key, setting_value').eq('is_public', true),
      client.from('social_links').select('platform, url').eq('is_active', true),
    ]);

    const socialMap = mapSocialRows(socialRes.data);
    const socialLinks: SocialLinks = {
      instagramUrl: socialMap.instagram || libraryConfig.socialLinks.instagramUrl,
      ownerInstagramUrl: socialMap.owner_instagram || libraryConfig.socialLinks.ownerInstagramUrl,
      facebookUrl: socialMap.facebook || '',
      whatsappNumber: socialMap.whatsapp || libraryConfig.socialLinks.whatsappNumber,
    };

    const settings = mapSettingsRows(settingsRes.data);

    return {
      announcements: normalizeAnnouncements(announcementsRes.data),
      facilities: normalizeFacilities(facilitiesRes.data),
      membershipPlans: normalizeMembershipPlans(plansRes.data),
      galleryItems: normalizeGallery(galleryRes.data),
      socialLinks,
      libraryConfig: {
        ...libraryConfig,
        address: settings.address ?? libraryConfig.address,
        addressShort: settings.address ?? libraryConfig.addressShort,
        hours: settings.hours ?? libraryConfig.hours,
        phoneDisplay: settings.phone_display ?? libraryConfig.phoneDisplay,
        phoneDigits: settings.whatsapp_number ?? libraryConfig.phoneDigits,
        directionsUrl: settings.directions_url ?? libraryConfig.directionsUrl,
        socialLinks,
      },
      websiteContent: {
        ...mapContentRows(contentRes.data),
      },
      settings,
    };
  } catch (error) {
    // On any failure, return empty data so the public site shows empty states instead of demo content.
    return emptyPublicData();
  }
}
