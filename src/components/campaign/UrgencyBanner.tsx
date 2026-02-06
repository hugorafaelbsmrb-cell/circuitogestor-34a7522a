import { motion } from 'framer-motion';
import { Clock, AlertTriangle, Zap, Sparkles } from 'lucide-react';

interface UrgencyBannerProps {
  message?: string;
  variant?: 'warning' | 'destructive' | 'default' | 'secondary';
}

export function UrgencyBanner({ 
  message = "Últimas vagas disponíveis! Garanta já a matrícula do seu filho.",
  variant = 'warning' 
}: UrgencyBannerProps) {
  const variants = {
    warning: 'bg-gradient-to-r from-orange-500 to-amber-500',
    destructive: 'bg-gradient-to-r from-red-600 to-red-500',
    default: 'bg-gradient-to-r from-primary to-primary/80',
    secondary: 'bg-gradient-to-r from-muted-foreground/80 to-muted-foreground',
  };

  const icons = {
    warning: AlertTriangle,
    destructive: Zap,
    default: Sparkles,
    secondary: Clock,
  };

  const Icon = icons[variant] || AlertTriangle;
  const bgClass = variants[variant] || variants.warning;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 1 }}
      className={`${bgClass} text-white py-3 px-4 text-center relative overflow-hidden`}
    >
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 bg-white/10"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        style={{ 
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          width: '50%',
        }}
      />

      <div className="relative flex items-center justify-center gap-2 font-medium">
        <Icon className="w-5 h-5 animate-pulse" />
        <span className="text-sm md:text-base">{message}</span>
      </div>
    </motion.div>
  );
}
