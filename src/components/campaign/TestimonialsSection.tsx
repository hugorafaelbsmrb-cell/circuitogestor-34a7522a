import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
}

interface TestimonialsSectionProps {
  testimonials?: Testimonial[];
}

const defaultTestimonials: Testimonial[] = [
  {
    name: "Maria Silva",
    role: "Mãe do Pedro, 8 anos",
    content: "Meu filho desenvolveu uma concentração incrível! As notas na escola melhoraram muito depois de 3 meses de curso.",
    rating: 5,
  },
  {
    name: "João Santos",
    role: "Pai da Ana, 10 anos",
    content: "A metodologia é fantástica. Minha filha adora as aulas e já consegue fazer cálculos que eu nem imaginava possível.",
    rating: 5,
  },
  {
    name: "Fernanda Costa",
    role: "Mãe do Lucas, 7 anos",
    content: "Equipe muito atenciosa e profissional. Vale cada centavo investido no futuro do meu filho!",
    rating: 5,
  },
];

export function TestimonialsSection({ testimonials = defaultTestimonials }: TestimonialsSectionProps) {
  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-to-b from-background to-muted/20 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-foreground">
            O que os pais dizem
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-2xl mx-auto px-2">
            Histórias reais de famílias que transformaram a educação de seus filhos
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <Card className="h-full bg-card hover:shadow-lg sm:hover:shadow-xl transition-shadow duration-300 border-border/50">
                <CardContent className="p-5 sm:p-6">
                  <Quote className="w-8 h-8 sm:w-10 sm:h-10 text-primary/20 mb-3 sm:mb-4" />
                  
                  {/* Rating */}
                  <div className="flex gap-0.5 sm:gap-1 mb-3 sm:mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 fill-primary text-primary" />
                    ))}
                  </div>

                  {/* Content */}
                  <p className="text-sm sm:text-base text-foreground mb-4 sm:mb-6 leading-relaxed italic">
                    "{testimonial.content}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm sm:text-base">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
