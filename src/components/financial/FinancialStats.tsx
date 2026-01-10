import { DollarSign, Clock, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialStatsProps {
  totalValue: number;
  pendingValue: number;
  receivedValue: number;
  overdueValue: number;
  totalPayments: number;
}

export function FinancialStats({
  totalValue,
  pendingValue,
  receivedValue,
  overdueValue,
  totalPayments,
}: FinancialStatsProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const stats = [
    {
      title: 'Total Geral',
      value: formatCurrency(totalValue),
      subtitle: `${totalPayments} boletos`,
      icon: DollarSign,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Pendentes',
      value: formatCurrency(pendingValue),
      subtitle: 'Aguardando pagamento',
      icon: Clock,
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-500',
    },
    {
      title: 'Recebidos',
      value: formatCurrency(receivedValue),
      subtitle: 'Pagamentos confirmados',
      icon: CheckCircle2,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
    },
    {
      title: 'Vencidos',
      value: formatCurrency(overdueValue),
      subtitle: 'Atenção necessária',
      icon: AlertCircle,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              </div>
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', stat.iconBg)}>
                <Icon className={cn('w-5 h-5', stat.iconColor)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
