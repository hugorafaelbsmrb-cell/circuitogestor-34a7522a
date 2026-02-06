import { motion } from 'framer-motion';
import { Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target, Rocket, Brain, CheckCircle2 } from 'lucide-react';

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
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

export function AnimatedBenefitsSection({ 
  benefits, 
  title = "Por que escolher nossa escola?",
  subtitle = "Diferenciais que fazem a diferença na educação do seu filho" 
}: AnimatedBenefitsSectionProps) {
  if (benefits.length === 0) return null;

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
            {title}
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            {subtitle}
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {benefits.map((benefit, index) => {
            const IconComponent = iconMap[benefit.icon] || Star;
            
            return (
              <motion.div 
                key={index}
                variants={itemVariants}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative bg-card rounded-3xl p-8 text-center shadow-lg hover:shadow-2xl transition-all duration-300 border border-border/50 overflow-hidden"
              >
                {/* Gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <motion.div 
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <IconComponent className="w-10 h-10 text-primary" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
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
