import { Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target } from 'lucide-react';

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface BenefitsSectionProps {
  benefits: Benefit[];
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
};

export function BenefitsSection({ benefits }: BenefitsSectionProps) {
  if (benefits.length === 0) return null;

  return (
    <section className="py-16 px-4 bg-primary/5">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-foreground">
          Por que escolher nossa escola?
        </h2>
        <p className="text-muted-foreground text-center mb-12 text-lg">
          Diferenciais que fazem a diferença na educação do seu filho
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => {
            const IconComponent = iconMap[benefit.icon] || Star;
            
            return (
              <div 
                key={index}
                className="bg-background rounded-2xl p-6 text-center shadow-md hover:shadow-lg transition-shadow duration-300 border border-border"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <IconComponent className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
