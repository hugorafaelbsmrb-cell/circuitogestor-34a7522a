import { ExternalLink, FileText, Copy, CheckCircle2, Clock, AlertCircle, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { AsaasPayment } from '@/types/school';
import { cn } from '@/lib/utils';

interface PaymentTableProps {
  payments: AsaasPayment[];
  getGuardianName?: (customerId: string) => string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export function PaymentTable({ payments, getGuardianName, sortField, sortDirection, onSort }: PaymentTableProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Código copiado para a área de transferência.',
    });
  };

  const getStatusConfig = (status: AsaasPayment['status']) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      PENDING: { label: 'Pendente', variant: 'secondary', icon: Clock },
      RECEIVED: { label: 'Recebido', variant: 'default', icon: CheckCircle2 },
      CONFIRMED: { label: 'Confirmado', variant: 'default', icon: CheckCircle2 },
      RECEIVED_IN_CASH: { label: 'Pago em Dinheiro', variant: 'default', icon: CheckCircle2 },
      OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
      REFUNDED: { label: 'Estornado', variant: 'outline', icon: AlertCircle },
    };
    return configs[status] || { label: status, variant: 'outline' as const, icon: Clock };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-3 h-8 data-[active=true]:text-primary"
      onClick={() => onSort(field)}
      data-active={sortField === field}
    >
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </Button>
  );

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum pagamento encontrado com os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[300px]">
              <SortButton field="description">Descrição</SortButton>
            </TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>
              <SortButton field="dueDate">Vencimento</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="value">Valor</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="status">Status</SortButton>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const statusConfig = getStatusConfig(payment.status);
            const StatusIcon = statusConfig.icon;
            const isOverdue = payment.status === 'OVERDUE';

            return (
              <TableRow 
                key={payment.id}
                className={cn(isOverdue && "bg-destructive/5")}
              >
                <TableCell>
                  <div>
                    <p className="font-medium line-clamp-1">{payment.description || 'Sem descrição'}</p>
                    {payment.installment && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Parcela {payment.installment}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getGuardianName ? getGuardianName(payment.customerId) : '-'}
                </TableCell>
                <TableCell>{formatDate(payment.dueDate)}</TableCell>
                <TableCell className="font-semibold text-primary">
                  {formatCurrency(payment.value)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant} className="gap-1">
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {payment.bankSlipUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(payment.bankSlipUrl, '_blank')}
                        title="Ver Boleto"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    {payment.invoiceUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(payment.invoiceUrl, '_blank')}
                        title="Ver Fatura"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(payment.id)}
                      title="Copiar ID"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
