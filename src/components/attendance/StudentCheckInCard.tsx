import { Check, Clock, X, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StudentCheckInCardProps {
  studentId: string;
  studentName: string;
  courseName: string;
  classGroupName: string;
  expectedTime: string;
  status: 'pending' | 'present' | 'absent' | 'late';
  checkedInAt?: string | null;
  recordId?: string;
  onCheckIn: (studentId: string, classGroupId: string) => Promise<boolean>;
  onUndo?: (recordId: string) => Promise<boolean>;
  classGroupId: string;
  isLoading?: boolean;
}

export function StudentCheckInCard({
  studentId,
  studentName,
  courseName,
  classGroupName,
  expectedTime,
  status,
  checkedInAt,
  recordId,
  onCheckIn,
  onUndo,
  classGroupId,
  isLoading,
}: StudentCheckInCardProps) {
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const formatDateTime = (dateTime: string) => {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleCheckIn = async () => {
    await onCheckIn(studentId, classGroupId);
  };

  const handleUndo = async () => {
    if (recordId && onUndo) {
      await onUndo(recordId);
    }
  };

  const statusConfig = {
    pending: {
      bg: 'bg-muted',
      border: 'border-border',
      badge: 'bg-muted text-muted-foreground',
      badgeText: 'Pendente',
      icon: Clock,
    },
    present: {
      bg: 'bg-green-50 dark:bg-green-950/30',
      border: 'border-green-200 dark:border-green-800',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      badgeText: 'Presente',
      icon: Check,
    },
    late: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
      border: 'border-yellow-200 dark:border-yellow-800',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      badgeText: 'Atrasado',
      icon: Clock,
    },
    absent: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      badgeText: 'Ausente',
      icon: X,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card
      className={cn(
        'p-4 transition-all duration-200 border-2',
        config.bg,
        config.border,
        status === 'pending' && 'hover:border-primary cursor-pointer hover:shadow-md'
      )}
      onClick={status === 'pending' ? handleCheckIn : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{studentName}</h3>
            <Badge variant="outline" className={cn('text-xs shrink-0', config.badge)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.badgeText}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {courseName} • {classGroupName}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              Esperado: {formatTime(expectedTime)}
            </span>
            {checkedInAt && (
              <span className="text-xs text-muted-foreground">
                • Chegou: {formatDateTime(checkedInAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status === 'pending' ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCheckIn();
              }}
              disabled={isLoading}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">Presente</span>
            </Button>
          ) : (status === 'present' || status === 'late') && onUndo && recordId ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleUndo();
              }}
              disabled={isLoading}
              className="gap-1"
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Desfazer</span>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
