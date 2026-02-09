import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, Sparkles, Clock, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import defaultHeroImage from '@/assets/campaign-hero.jpg';

interface AnimatedHeroSectionProps {
  title: string;
  subtitle: string;
  backgroundImage?: string;
  onCtaClick: () => void;
  urgencyText?: string;
  socialProofCount?: number;
  trustIndicators?: string[];
}

export function AnimatedHeroSection({ 
  title, 
  subtitle, 
  backgroundImage, 
  onCtaClick,
  urgencyText,
  socialProofCount,
  trustIndicators = ['Sem taxas ocultas', 'Primeira semana grátis', 'Cancele quando quiser']
}: AnimatedHeroSectionProps) {
  const heroImageUrl = backgroundImage || defaultHeroImage;
  const isMobile = useIsMobile();
  
  return (
    <section 
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.7) 100%), url(${heroImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        // Fixed attachment only on desktop - breaks on iOS
        backgroundAttachment: isMobile ? 'scroll' : 'fixed',
      }}
    >
      {/* Animated gradient overlay - reduced on mobile for performance */}
      {!isMobile && (
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20"
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
        />
      )}

      {/* Floating decorative elements - hidden on mobile for performance */}
      {!isMobile && (
        <>
          <motion.div 
            className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl"
            animate={{ 
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-20 right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl"
            animate={{ 
              y: [0, -30, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto py-12">
        {/* Urgency Badge */}
        {urgencyText && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge 
              variant="destructive" 
              className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold animate-pulse"
            >
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              {urgencyText}
            </Badge>
          </motion.div>
        )}

        {/* Main Title */}
        <motion.h1 
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white mb-4 sm:mb-6 leading-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text">
            {title}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {subtitle}
        </motion.p>

        {/* Social Proof */}
        {socialProofCount && socialProofCount > 0 && (
          <motion.div
            className="flex items-center justify-center gap-2 mb-6 sm:mb-8 text-white/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm md:text-base">
              +{socialProofCount} famílias já escolheram nossa escola
            </span>
          </motion.div>
        )}

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Button 
            size="lg" 
            onClick={onCtaClick}
            className="group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground text-base sm:text-lg md:text-xl px-6 sm:px-8 md:px-10 py-5 sm:py-6 md:py-7 font-bold shadow-2xl hover:shadow-primary/25 transition-all duration-300 hover:scale-105 rounded-full active:scale-95"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:animate-spin" />
            Quero garantir minha vaga!
          </Button>
        </motion.div>

        {/* Trust indicators */}
        {trustIndicators.length > 0 && (
          <motion.div 
            className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-4 text-white/70 text-xs sm:text-sm px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            {trustIndicators.map((indicator, index) => (
              <span key={index} className="flex items-center gap-1">
                ✓ {indicator}
              </span>
            ))}
          </motion.div>
        )}
      </div>

      {/* Scroll indicator */}
      <motion.div 
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ArrowDown className="w-6 h-6 sm:w-8 sm:h-8 text-white/50" />
      </motion.div>
    </section>
  );
}
