'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Dumbbell,
  Flame,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Quote,
  Sparkles,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { loadPublicSiteData } from '@/lib/content-service';
import { getWhatsAppUrl, whatsappMessages, siteConfig, type PublicSiteData } from '@/lib/site-config';

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Facilities', href: '#facilities' },
  { label: 'Membership', href: '#membership' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Contact', href: '#contact' },
];

const defaultGalleryItems = [
  { id: 'def-1', image: '/images/rr-fitness-gym-interior.jpg', title: 'Modern Gym Floor', category: 'Training Area', alt: 'RR Fitness gym interior' },
  { id: 'def-2', image: '/images/rr-fitness-dumbbell-area.jpg', title: 'Dumbbell & Free Weights', category: 'Free Weights', alt: 'RR Fitness dumbbell area' },
  { id: 'def-3', image: '/images/rr-fitness-dumbbells.jpg', title: 'Weight Racks & Equipment', category: 'Equipment', alt: 'RR Fitness dumbbells' },
  { id: 'def-4', image: '/images/rr-fitness-entrance.jpg', title: 'Main Gym Entrance', category: 'Entrance', alt: 'RR Fitness entrance' },
  { id: 'def-5', image: '/images/rr-fitness-exterior.jpg', title: 'RR Fitness Location', category: 'Exterior', alt: 'RR Fitness exterior' },
];

function WhatsAppButton({ message = whatsappMessages.general, children, className = '' }: { message?: string; children: React.ReactNode; className?: string }) {
  return (
    <a className={`button button-primary ${className}`} href={getWhatsAppUrl(message)} target="_blank" rel="noreferrer">
      <MessageCircle size={17} strokeWidth={2.2} />
      {children}
    </a>
  );
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="section-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export default function LibrarySite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const initialSiteData: PublicSiteData = {
    announcements: [],
    facilities: [],
    membershipPlans: [],
    galleryItems: [],
    socialLinks: { instagramUrl: siteConfig.socialLinks.instagramUrl || '', facebookUrl: siteConfig.socialLinks.facebookUrl || '', whatsappNumber: siteConfig.socialLinks.whatsappNumber || '' },
    libraryConfig: { ...siteConfig },
    websiteContent: {},
    settings: {},
  };

  const [siteData, setSiteData] = useState<PublicSiteData>(initialSiteData);

  useEffect(() => {
    loadPublicSiteData().then(setSiteData).catch(() => undefined);
  }, []);

  const currentConfig = siteData.libraryConfig;
  const announcements = siteData.announcements;
  const facilities = siteData.facilities;
  const membershipPlans = siteData.membershipPlans;
  const galleryItems = siteData.galleryItems.length ? siteData.galleryItems : defaultGalleryItems;
  const content = siteData.websiteContent as Record<string, string>;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(`${currentConfig.address} (Near ${currentConfig.locationRef})`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main>
      <div className="topbar">
        <div className="container topbar-inner">
          <span><Clock3 size={14} /> Open until 10 PM</span>
          <span className="topbar-divider" />
          <span><MapPin size={14} /> {currentConfig.addressShort} (Near {currentConfig.locationRef})</span>
          <a href={`tel:${currentConfig.phoneDigits}`}><Phone size={14} /> {currentConfig.phoneDisplay}</a>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#home" aria-label="RR Fitness home">
            <img className="brand-logo" src={currentConfig.logoPath} alt="RR Fitness logo" />
            <div>
              <strong>RR FITNESS</strong>
              <small>JHABRERA</small>
            </div>
          </a>
          <nav className={`desktop-nav ${menuOpen ? 'mobile-nav-open' : ''}`} aria-label="Main navigation">
            {navItems.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
            <WhatsAppButton message={whatsappMessages.general}>Join Now</WhatsAppButton>
          </nav>
          <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-pattern" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="rating-pill">
              <span className="rating-stars"><Star size={13} fill="currentColor" /> <Star size={13} fill="currentColor" /> <Star size={13} fill="currentColor" /> <Star size={13} fill="currentColor" /> <Star size={13} fill="currentColor" /></span>
              <strong>RR Fitness</strong>
              <span>Jhabrera</span>
            </div>
            <h1>{content.hero_heading || 'RR FITNESS'}</h1>
            <p className="hero-lede">
              {content.hero_description || 'Train Hard. Stay Strong. A modern fitness destination in Jhabrera.'}
            </p>
            <div className="hero-actions">
              <WhatsAppButton message={whatsappMessages.general}>{content.hero_cta_text || 'Join Now'}</WhatsAppButton>
              <a className="button button-outline" href={getWhatsAppUrl(whatsappMessages.general)} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> WhatsApp Us
              </a>
            </div>
            <div className="hero-trust">
              <span><Check size={15} /> Dumbbell Area</span>
              <span><Check size={15} /> Modern Equipment</span>
              <span><Check size={15} /> Open until 10 PM</span>
              <span><Check size={15} /> Jhabrera Location</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-wrap">
              <img src="/images/rr-fitness-gym-interior.jpg" alt="RR Fitness gym interior" />
              <div className="image-shade" />
              <div className="hero-image-caption">
                <span className="caption-dot" />
                <span>Train Hard. Stay Strong.</span>
              </div>
            </div>
            <div className="hero-note">
              <Dumbbell size={18} />
              <span><strong>RR Fitness Jhabrera</strong><br />Open daily until 10 PM</span>
            </div>
          </div>
        </div>
        <div className="hero-bottom container">
          <span className="scroll-label">Scroll to explore</span>
          <span className="scroll-line" />
        </div>
      </section>

      <section className="announcement-section">
        <div className="container announcement-card">
          <div className="announcement-label"><span className="announcement-dot" /> Gym Notice Board</div>
          <div className="announcement-content">
            {announcements.filter((item) => item.active).length ? (
              announcements.filter((item) => item.active).map((announcement) => (
                <div key={announcement.id}>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                </div>
              ))
            ) : (
              <div>
                <h3>Welcome to RR Fitness</h3>
                <p>Visit us in Jhabrera or message us on WhatsApp for current gym updates.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="about-section section-space" id="about">
        <div className="container about-grid">
          <div className="about-images">
            <div className="about-main-image">
              <img src="/images/rr-fitness-dumbbell-area.jpg" alt="RR Fitness dumbbell area" />
            </div>
            <div className="about-small-image">
              <img src="/images/rr-fitness-entrance.jpg" alt="RR Fitness gym entrance" />
            </div>
            <div className="experience-stamp">
              <span className="stamp-star">✦</span>
              <strong>RR<br />FITNESS<br /><i>GYM</i></strong>
            </div>
          </div>
          <div className="about-copy">
            <SectionIntro
              eyebrow="About RR Fitness"
              title={content.about_heading || 'Train Hard. Stay Strong.'}
              description={content.about_description || 'A modern fitness destination in Jhabrera offering quality gym equipment and a clean, dedicated workout space.'}
            />
            <p>
              Whether you are focusing on strength training, building endurance, or maintaining daily fitness, RR Fitness provides the equipment and environment you need to achieve your goals.
            </p>
            <div className="about-signature">
              <span className="signature-line" />
              <span>Stronger every single day.</span>
            </div>
            <a className="text-link" href="#facilities">
              Explore Gym Facilities <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section className="facilities-section section-space" id="facilities">
        <div className="container">
          <SectionIntro
            eyebrow="Facilities & Training"
            title={content.facilities_heading || 'Everything You Need To Train'}
            description={content.facilities_description || 'Quality workout environment with dedicated dumbbell area and fitness equipment in Jhabrera.'}
          />
          <div className="facilities-grid">
            {facilities.map((facility, index) => (
              <article className={`facility-card ${index === 0 ? 'facility-card-featured' : ''}`} key={facility.id}>
                <div className="facility-icon">
                  {index === 0 ? <Dumbbell size={22} /> : index === 1 ? <Flame size={22} /> : index === 2 ? <Sparkles size={22} /> : <Clock3 size={22} />}
                </div>
                <span className="facility-number">0{index + 1}</span>
                <h3>{facility.title}</h3>
                <p>{facility.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="quote-section">
        <div className="container quote-inner">
          <Quote size={35} className="quote-mark" />
          <blockquote dangerouslySetInnerHTML={{ __html: 'Train Hard.<br />Stay Strong.' }} />
          <p>Consistency and determination define your fitness journey at RR Fitness.</p>
        </div>
      </section>

      <section className="membership-section section-space" id="membership">
        <div className="container">
          <SectionIntro
            eyebrow="Gym Membership"
            title={content.membership_heading || 'Join RR Fitness'}
            description={content.membership_description || 'Start your fitness journey today. Inquire directly for current plans.'}
          />
          {membershipPlans.length ? (
            <div className="plans-grid">
              {membershipPlans.map((plan) => (
                <article key={plan.id} className={`plan-card ${plan.featured ? 'plan-card-featured' : ''}`}>
                  {plan.featured && <span className="popular-label">Popular Choice</span>}
                  <h3>{plan.name}</h3>
                  <p className="plan-description">{plan.description}</p>
                  <div className="plan-price">{plan.price}</div>
                  <div className="plan-rule" />
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <WhatsAppButton message={whatsappMessages.membership} className="plan-button">
                    Ask about this plan <ArrowRight size={16} />
                  </WhatsAppButton>
                </article>
              ))}
            </div>
          ) : (
            <div className="membership-empty">
              <p>Contact RR Fitness for current membership plans and pricing.</p>
              <span className="membership-empty-note">Reach out via WhatsApp or phone call for detailed membership pricing.</span>
              <WhatsAppButton message={whatsappMessages.membership}>Contact RR Fitness on WhatsApp</WhatsAppButton>
            </div>
          )}
        </div>
      </section>

      <section className="gallery-section section-space" id="gallery">
        <div className="container">
          <SectionIntro
            eyebrow="Gym Gallery"
            title={content.gallery_heading || 'A Look Inside RR Fitness'}
            description={content.gallery_description || 'Real photographs of RR Fitness gym in Jhabrera.'}
          />
          <div className="gallery-grid">
            {galleryItems.map((item, index) => (
              <figure className={`gallery-item ${index === 0 ? 'gallery-item-featured' : ''}`} key={item.id}>
                <img src={item.image} alt={item.alt || item.title} />
                <figcaption>
                  <span>{item.category}</span>
                  <strong>{item.title}</strong>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="contact-section section-space" id="contact">
        <div className="container contact-grid">
          <div className="contact-copy">
            <SectionIntro
              eyebrow="Visit Us"
              title={content.contact_heading || 'Visit RR Fitness.'}
              description={content.contact_description || 'We are located in Jhabrera, Uttarakhand near Ambika Battery.'}
            />
            <div className="contact-details">
              <div className="contact-detail">
                <span className="detail-icon"><MapPin size={18} /></span>
                <div>
                  <small>Address</small>
                  <p>{currentConfig.address}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Location ref: Near {currentConfig.locationRef}</p>
                  <button onClick={copyAddress} className="copy-button">
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy address'}
                  </button>
                </div>
              </div>
              <div className="contact-detail">
                <span className="detail-icon"><Phone size={18} /></span>
                <div>
                  <small>Call Us</small>
                  <a href={`tel:${currentConfig.phoneDigits}`}>{currentConfig.phoneDisplay}</a>
                </div>
              </div>
              <div className="contact-detail">
                <span className="detail-icon"><Clock3 size={18} /></span>
                <div>
                  <small>Opening Hours</small>
                  <p>{currentConfig.hours}</p>
                </div>
              </div>
            </div>
            <div className="contact-actions">
              <a className="button button-dark" href={`tel:${currentConfig.phoneDigits}`}>
                <Phone size={17} /> Call Now
              </a>
              <WhatsAppButton>WhatsApp</WhatsAppButton>
              {currentConfig.socialLinks.instagramUrl && (
                <a className="button button-outline" href={currentConfig.socialLinks.instagramUrl} target="_blank" rel="noreferrer" aria-label="RR Fitness Instagram">
                  <Instagram size={17} /> RR Fitness Instagram
                </a>
              )}
              {currentConfig.socialLinks.ownerInstagramUrl && (
                <a className="button button-outline" href={currentConfig.socialLinks.ownerInstagramUrl} target="_blank" rel="noreferrer" aria-label="Owner Instagram">
                  <UserCheck size={17} /> Owner Instagram
                </a>
              )}
            </div>
          </div>
          <div className="map-card">
            <img src="/images/rr-fitness-exterior.jpg" alt="RR Fitness exterior view" />
            <div className="map-card-shade" />
            <div className="map-card-info">
              <span className="eyebrow">RR FITNESS GYM</span>
              <p>{currentConfig.address} (Near {currentConfig.locationRef})</p>
              <a href={currentConfig.directionsUrl} target="_blank" rel="noreferrer">
                Open in Google Maps <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-main">
          <div>
            <a className="brand brand-footer" href="#home" aria-label="RR Fitness home">
              <img className="brand-logo" src={currentConfig.logoPath} alt="RR Fitness logo" />
            </a>
            <p className="footer-tagline">Train Hard. Stay Strong.</p>
          </div>
          <div className="footer-links">
            <span className="footer-heading">Explore</span>
            {navItems.slice(1, 5).map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          </div>
          <div className="footer-links">
            <span className="footer-heading">Connect</span>
            <a href={`tel:${currentConfig.phoneDigits}`}>{currentConfig.phoneDisplay}</a>
            <a href={getWhatsAppUrl(whatsappMessages.general)} target="_blank" rel="noreferrer">WhatsApp</a>
            {currentConfig.socialLinks.instagramUrl && (
              <a href={currentConfig.socialLinks.instagramUrl} target="_blank" rel="noreferrer" aria-label="RR Fitness Instagram">
                <Instagram size={15} /> RR Fitness Instagram
              </a>
            )}
            {currentConfig.socialLinks.ownerInstagramUrl && (
              <a href={currentConfig.socialLinks.ownerInstagramUrl} target="_blank" rel="noreferrer" aria-label="Owner Instagram">
                <Instagram size={15} /> Owner Instagram
              </a>
            )}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} RR Fitness</span>
          <span>{currentConfig.addressShort}</span>
        </div>
      </footer>
    </main>
  );
}

