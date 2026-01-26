import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import defaultHeroImage from '@/assets/campaign-hero.jpg';

interface HeroSectionProps {
  title: string;
  subtitle: string;
  backgroundImage?: string;
  onCtaClick: () => void;
}

export function HeroSection({ title, subtitle, backgroundImage, onCtaClick }: HeroSectionProps) {
  const heroImageUrl = backgroundImage || defaultHeroImage;
  console.log('🎨 HeroSection rendering:', { title, subtitle, backgroundImage, heroImageUrl });
  
  return (
    <section 
      className="relative min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${heroImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          {title}
        </h1>
        <p className="text-lg md:text-xl lg:text-2xl text-white/90 mb-10 max-w-2xl mx-auto">
          {subtitle}
        </p>
        <Button 
          size="lg" 
          onClick={onCtaClick}
          className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 font-semibold shadow-2xl hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          Quero garantir minha vaga!
        </Button>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="w-8 h-8 text-white/70" />
      </div>
    </section>
  );
}
