import { motion } from 'framer-motion';
import { Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target, Rocket, Brain } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface AnimatedBenefitsSectionProps {
  benefits: Benefit[];
  title?: string;
  subtitle?: string;
}

const iconMap: Record<string, React.ElementType> = {
  Users,
  Award,
  GraduationCap,
  Clock,
  Star,
  Heart,
  Lightbulb,
  Target,
  Rocket,
  Brain,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

export function AnimatedBenefitsSection({ 
  benefits, 
  title = "Por que escolher nossa escola?",
  subtitle = "Diferenciais que fazem a diferença na educação do seu filho" 
}: AnimatedBenefitsSectionProps) {
  const isMobile = useIsMobile();
  
  if (benefits.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-to-b from-background to-muted/30 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-foreground">
            {title}
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-2xl mx-auto px-2">
            {subtitle}
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-30px" }}
        >
          {benefits.map((benefit, index) => {
            const IconComponent = iconMap[benefit.icon] || Star;
            
            return (
              <motion.div 
                key={index}
                variants={itemVariants}
                whileHover={isMobile ? undefined : { y: -8, scale: 1.02 }}
                className="group relative bg-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 border border-border/50 overflow-hidden"
              >
                {/* Gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                    <IconComponent className="w-7 h-7 sm:w-10 sm:h-10 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
