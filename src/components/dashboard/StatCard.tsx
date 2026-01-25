import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('stat-card animate-fade-in', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-xl lg:text-3xl font-semibold text-foreground mt-1 lg:mt-2">{value}</p>
          {description && (
            <p className="text-xs lg:text-sm text-muted-foreground mt-1 truncate">{description}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs lg:text-sm mt-1 lg:mt-2 font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}% este mês
            </p>
          )}
        </div>
        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ml-2">
          <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
