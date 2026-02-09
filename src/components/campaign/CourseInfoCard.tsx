import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, Sparkles } from 'lucide-react';

interface CourseInfoCardProps {
  name: string;
  description?: string;
  duration: string;
  price: number;
  originalPrice?: number;
  onCtaClick: () => void;
  features?: string[];
  ctaText?: string;
  priceLabel?: string;
  priceSuffix?: string;
}

export function CourseInfoCard({ 
  name, 
  description, 
  duration, 
  price, 
  originalPrice,
  onCtaClick,
  features = [
    'Material didático incluso',
    'Certificado de conclusão',
    'Turmas reduzidas',
    'Acompanhamento individual',
  ],
  ctaText = 'Matricular agora',
  priceLabel = 'A partir de',
  priceSuffix = '/mês',
}: CourseInfoCardProps) {
  const hasDiscount = originalPrice && originalPrice > price;
  const discountPercentage = hasDiscount 
    ? Math.round(((originalPrice - price) / originalPrice) * 100) 
    : 0;

  const formatPrice = (value: number) => {
    const integerPart = Math.floor(value);
    const decimalPart = Math.round((value - integerPart) * 100);
    return { integer: integerPart, decimal: decimalPart.toString().padStart(2, '0') };
  };

  const priceFormatted = formatPrice(price);
  const originalPriceFormatted = originalPrice ? formatPrice(originalPrice) : null;

  return (
    <section className="py-12 sm:py-16 px-4 bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="relative overflow-hidden border-2 border-primary/20 shadow-xl sm:shadow-2xl">
            {/* Discount badge */}
            <div className="absolute top-0 right-0">
              {hasDiscount ? (
                <Badge className="rounded-none rounded-bl-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground font-semibold">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  -{discountPercentage}% OFF
                </Badge>
              ) : (
                <Badge className="rounded-none rounded-bl-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Mais Popular
                </Badge>
              )}
            </div>

            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Left side - Course info */}
                <div className="p-6 sm:p-8 md:p-10 bg-gradient-to-br from-primary/5 to-transparent">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 pr-16 sm:pr-0">
                    {name}
                  </h3>
                  
                  {description && (
                    <p className="text-muted-foreground mb-4 sm:mb-6 text-base sm:text-lg leading-relaxed">
                      {description}
                    </p>
                  )}

                  {features.length > 0 && (
                    <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                      {features.map((feature, index) => (
                        <motion.div 
                          key={index}
                          className="flex items-center gap-2 sm:gap-3"
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.1, duration: 0.3 }}
                        >
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                          <span className="text-sm sm:text-base text-foreground">{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right side - Pricing */}
                <div className="p-6 sm:p-8 md:p-10 bg-card flex flex-col justify-center items-center text-center border-t md:border-t-0 md:border-l border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <span className="text-sm sm:text-base text-muted-foreground">Duração: {duration}</span>
                  </div>

                  <div className="my-4 sm:my-6">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">{priceLabel}</p>
                    
                    {/* Original price (crossed out) */}
                    {hasDiscount && originalPriceFormatted && (
                      <motion.div 
                        className="flex items-baseline justify-center gap-0.5 text-muted-foreground"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <span className="text-sm sm:text-base line-through">
                          R$ {originalPriceFormatted.integer},{originalPriceFormatted.decimal}
                        </span>
                      </motion.div>
                    )}
                    
                    {/* Promotional price */}
                    <motion.div 
                      className="flex items-baseline justify-center gap-1"
                      initial={hasDiscount ? { scale: 0.8, opacity: 0 } : {}}
                      animate={hasDiscount ? { scale: 1, opacity: 1 } : {}}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    >
                      <span className="text-base sm:text-lg text-muted-foreground">R$</span>
                      <span className={`text-4xl sm:text-5xl md:text-6xl font-extrabold ${hasDiscount ? 'text-destructive' : 'text-primary'}`}>
                        {priceFormatted.integer}
                      </span>
                      <span className="text-base sm:text-lg text-muted-foreground">,{priceFormatted.decimal}</span>
                    </motion.div>
                    
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">{priceSuffix}</p>
                    
                    {/* Savings badge */}
                    {hasDiscount && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="mt-2"
                      >
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                          Economia de R$ {(originalPrice - price).toFixed(2).replace('.', ',')}
                        </Badge>
                      </motion.div>
                    )}
                  </div>

                  <Button 
                    size="lg"
                    onClick={onCtaClick}
                    className="w-full max-w-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold py-5 sm:py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    {ctaText}
                  </Button>

                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
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