import { Users, UserCheck, Clock, UserX, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AttendanceStatsProps {
  total: number;
  present: number;
  late: number;
  absent: number;
  pending: number;
}

export function AttendanceStats({ total, present, late, absent, pending }: AttendanceStatsProps) {
  const stats = [
    {
      label: 'Total Esperado',
      value: total,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Presentes',
      value: present,
      icon: UserCheck,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Atrasados',
      value: late,
      icon: Clock,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      label: 'Ausentes',
      value: absent,
      icon: UserX,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      label: 'Pendentes',
      value: pending,
      icon: HelpCircle,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
