import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import defaultHeroImage from '@/assets/campaign-hero.jpg';

interface HeroSectionProps {
  title: string;
  subtitle: string;
  backgroundImage?: string;
  onCtaClick: () => void;
}

export function HeroSection({ title, subtitle, backgroundImage, onCtaClick }: HeroSectionProps) {
  const heroImageUrl = backgroundImage || defaultHeroImage;
  const isMobile = useIsMobile();
  
  return (
    <section 
      className="relative min-h-[85svh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${heroImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        // Fixed attachment breaks on iOS Safari
        backgroundAttachment: isMobile ? 'scroll' : 'fixed',
      }}
    >
      {/* Decorative elements - simpler on mobile */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-60 sm:w-80 h-60 sm:h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-60 sm:w-80 h-60 sm:h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto py-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
          {title}
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-8 sm:mb-10 max-w-2xl mx-auto px-2">
          {subtitle}
        </p>
        <Button 
          size="lg" 
          onClick={onCtaClick}
          className="bg-white text-primary hover:bg-white/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 font-semibold shadow-2xl hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
        >
          Quero garantir minha vaga!
        </Button>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="w-6 h-6 sm:w-8 sm:h-8 text-white/70" />
      </div>
    </section>
  );
}
