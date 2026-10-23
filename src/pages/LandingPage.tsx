import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import SecuritySection from '@/components/landing/SecuritySection';
import PricingSection from '@/components/landing/PricingSection';
import FAQSection from '@/components/landing/FAQSection';
import FinalCTASection from '@/components/landing/FinalCTASection';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePublicTheme } from '@/hooks/usePublicTheme';

export default function LandingPage() {
  usePageTitle('Bulut PDKS ve Geçiş Kontrol Sistemi');
  usePublicTheme();
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }, [hash, key]);
  return (
    <div className="pub-page">
      <PublicHeader tone="burgundy" />
      <main id="main" tabIndex={-1}>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SecuritySection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <PublicFooter />
    </div>
  );
}
