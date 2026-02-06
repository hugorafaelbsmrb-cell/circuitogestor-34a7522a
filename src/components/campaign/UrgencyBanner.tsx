import { motion } from 'framer-motion';
import { Clock, AlertTriangle, Zap } from 'lucide-react';

interface UrgencyBannerProps {
  message?: string;
  variant?: 'warning' | 'info' | 'promo';
}

export function UrgencyBanner({ 
  message = "Últimas vagas disponíveis! Garanta já a matrícula do seu filho.",
  variant = 'warning' 
}: UrgencyBannerProps) {
  const variants = {
    warning: 'bg-gradient-to-r from-orange-500 to-red-500',
    info: 'bg-gradient-to-r from-blue-500 to-purple-500',
    promo: 'bg-gradient-to-r from-green-500 to-emerald-500',
  };

  const icons = {
    warning: AlertTriangle,
    info: Clock,
    promo: Zap,
  };

  const Icon = icons[variant];

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 1 }}
      className={`${variants[variant]} text-white py-3 px-4 text-center relative overflow-hidden`}
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
