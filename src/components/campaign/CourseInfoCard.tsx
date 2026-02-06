import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, DollarSign, CheckCircle2, Sparkles, Gift, Shield } from 'lucide-react';

interface CourseInfoCardProps {
  name: string;
  description?: string;
  duration: string;
  price: number;
  onCtaClick: () => void;
  features?: string[];
}

export function CourseInfoCard({ 
  name, 
  description, 
  duration, 
  price, 
  onCtaClick,
  features = [
    'Material didático incluso',
    'Certificado de conclusão',
    'Turmas reduzidas',
    'Acompanhamento individual',
  ]
}: CourseInfoCardProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Card className="relative overflow-hidden border-2 border-primary/20 shadow-2xl">
            {/* Popular badge */}
            <div className="absolute top-0 right-0">
              <Badge className="rounded-none rounded-bl-xl px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold">
                <Sparkles className="w-4 h-4 mr-1" />
                Mais Popular
              </Badge>
            </div>

            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Left side - Course info */}
                <div className="p-8 md:p-10 bg-gradient-to-br from-primary/5 to-transparent">
                  <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                    {name}
                  </h3>
                  
                  {description && (
                    <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                      {description}
                    </p>
                  )}

                  <div className="space-y-3 mb-6">
                    {features.map((feature, index) => (
                      <motion.div 
                        key={index}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1, duration: 0.4 }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      Garantia de 7 dias
                    </div>
                    <div className="flex items-center gap-1">
                      <Gift className="w-4 h-4" />
                      Bônus exclusivos
                    </div>
                  </div>
                </div>

                {/* Right side - Pricing */}
                <div className="p-8 md:p-10 bg-card flex flex-col justify-center items-center text-center border-t md:border-t-0 md:border-l border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">Duração: {duration}</span>
                  </div>

                  <div className="my-6">
                    <p className="text-sm text-muted-foreground mb-1">A partir de</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-lg text-muted-foreground">R$</span>
                      <span className="text-5xl md:text-6xl font-extrabold text-primary">
                        {price.toFixed(0).replace('.', ',')}
                      </span>
                      <span className="text-lg text-muted-foreground">,{(price % 1).toFixed(2).split('.')[1]}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">/mês</p>
                  </div>

                  <Button 
                    size="lg"
                    onClick={onCtaClick}
                    className="w-full max-w-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Matricular agora
                  </Button>

                  <p className="text-xs text-muted-foreground mt-4">
                    ✓ Parcele em até 12x no cartão
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
