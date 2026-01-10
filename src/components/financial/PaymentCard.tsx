import { CreditCard, ExternalLink, FileText, Copy, CheckCircle2, Clock, AlertCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { AsaasPayment } from '@/types/school';
import { cn } from '@/lib/utils';

interface PaymentCardProps {
  payment: AsaasPayment;
  guardianName?: string;
}

export function PaymentCard({ payment, guardianName }: PaymentCardProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Código copiado para a área de transferência.',
    });
  };

  const getStatusConfig = (status: AsaasPayment['status']) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; color: string }> = {
      PENDING: { label: 'Pendente', variant: 'secondary', icon: Clock, color: 'text-yellow-500' },
      RECEIVED: { label: 'Recebido', variant: 'default', icon: CheckCircle2, color: 'text-green-500' },
      CONFIRMED: { label: 'Confirmado', variant: 'default', icon: CheckCircle2, color: 'text-green-500' },
      OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle, color: 'text-destructive' },
      REFUNDED: { label: 'Estornado', variant: 'outline', icon: AlertCircle, color: 'text-muted-foreground' },
    };
    return configs[status] || { label: status, variant: 'outline' as const, icon: Clock, color: 'text-muted-foreground' };
  };

  const statusConfig = getStatusConfig(payment.status);
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const isOverdue = payment.status === 'OVERDUE';
  const isPending = payment.status === 'PENDING';

  return (
    <div className={cn(
      "bg-card border rounded-xl p-4 hover:shadow-md transition-all",
      isOverdue && "border-destructive/50 bg-destructive/5",
      isPending && "border-yellow-500/30"
    )}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Icon and Info */}
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
            isOverdue ? "bg-destructive/10" : "bg-primary/10"
          )}>
            <CreditCard className={cn(
              "w-6 h-6",
              isOverdue ? "text-destructive" : "text-primary"
            )} />
          </div>
          <div className="space-y-1">
            <p className="font-medium line-clamp-1">{payment.description || 'Sem descrição'}</p>
            {guardianName && (
              <p className="text-sm text-muted-foreground">Responsável: {guardianName}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Vencimento: {formatDate(payment.dueDate)}</span>
              {payment.paymentDate && (
                <>
                  <span>•</span>
                  <span>Pago em: {formatDate(payment.paymentDate)}</span>
                </>
              )}
            </div>
            {payment.installment && (
              <Badge variant="outline" className="text-xs">
                Parcela {payment.installment}
              </Badge>
            )}
          </div>
        </div>

        {/* Right: Value, Status and Actions */}
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="text-right">
            <p className="text-xl font-bold text-primary">
              {formatCurrency(payment.value)}
            </p>
            <Badge variant={statusConfig.variant} className="gap-1 mt-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {payment.bankSlipUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(payment.bankSlipUrl, '_blank')}
                className="gap-1"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Boleto</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {payment.invoiceUrl && (
                  <DropdownMenuItem onClick={() => window.open(payment.invoiceUrl, '_blank')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Fatura
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => copyToClipboard(payment.id)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar ID
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
