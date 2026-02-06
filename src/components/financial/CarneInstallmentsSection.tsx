import { ExternalLink, FileText, HandCoins, Loader2, CheckCircle2, QrCode, Printer, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  description: string;
  value: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  guardian_id: string;
  asaas_payment_id: string | null;
  bank_slip_url: string | null;
  invoice_url: string | null;
  installment_number: number | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
}

interface CarneInstallmentsSectionProps {
  carnePayments: Payment[];
  carneStatusFilter: string;
  setCarneStatusFilter: (value: string) => void;
  carneMonthFilter: string;
  setCarneMonthFilter: (value: string) => void;
  processingPaymentId: string | null;
  isAsaasLoading: boolean;
  onReceiveInCash: (payment: Payment) => void;
  onMarkAsConfirmed: (payment: Payment) => void;
  onOpenPixModal: (payment: Payment) => void;
}

export function CarneInstallmentsSection({
  carnePayments,
  carneStatusFilter,
  setCarneStatusFilter,
  carneMonthFilter,
  setCarneMonthFilter,
  processingPaymentId,
  isAsaasLoading,
  onReceiveInCash,
  onMarkAsConfirmed,
  onOpenPixModal,
}: CarneInstallmentsSectionProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  // Generate month options (current month + 11 months back + 6 months forward)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [{ value: 'all', label: 'Todos os meses' }];
    const now = new Date();
    
    // 11 months back
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    // 6 months forward (excluding current which is already included)
    for (let i = 1; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return options;
  }, []);

  // Filter by month and status
  const filteredCarnePayments = useMemo(() => {
    let filtered = carnePayments;
    
    // Month filter
    if (carneMonthFilter !== 'all') {
      const [year, month] = carneMonthFilter.split('-').map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      
      filtered = filtered.filter(p => {
        const dueDate = parseISO(p.due_date);
        return dueDate >= monthStart && dueDate <= monthEnd;
      });
    }
    
    // Status filter
    if (carneStatusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === carneStatusFilter);
    }
    
    return filtered;
  }, [carnePayments, carneMonthFilter, carneStatusFilter]);

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      PENDING: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      RECEIVED: { label: 'Pago', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      CONFIRMED: { label: 'Confirmado', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      RECEIVED_IN_CASH: { label: 'Pago em Dinheiro', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      OVERDUE: { label: 'Vencido', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    const config = configs[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  // Calculate stats for the current filter
  const stats = useMemo(() => {
    const total = filteredCarnePayments.reduce((sum, p) => sum + p.value, 0);
    const pending = filteredCarnePayments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    const pendingValue = pending.reduce((sum, p) => sum + p.value, 0);
    const paidValue = filteredCarnePayments
      .filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
      .reduce((sum, p) => sum + p.value, 0);
    
    return { total, pendingValue, paidValue, pendingCount: pending.length };
  }, [filteredCarnePayments]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Parcelas de Carnês
              </CardTitle>
              <CardDescription>
                {filteredCarnePayments.length} de {carnePayments.length} parcelas de carnês cadastrados
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Month filter */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select value={carneMonthFilter} onValueChange={setCarneMonthFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Status filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={carneStatusFilter} onValueChange={setCarneStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="RECEIVED">Recebido</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                    <SelectItem value="RECEIVED_IN_CASH">Pago em Dinheiro</SelectItem>
                    <SelectItem value="OVERDUE">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Stats bar */}
          {carneMonthFilter !== 'all' && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total do Mês</p>
                <p className="font-semibold">{formatCurrency(stats.total)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">A Receber</p>
                <p className="font-semibold text-yellow-600">{formatCurrency(stats.pendingValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="font-semibold text-green-600">{formatCurrency(stats.paidValue)}</p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredCarnePayments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            {carnePayments.length === 0 
              ? 'Nenhuma parcela de carnê cadastrada.' 
              : 'Nenhuma parcela encontrada com os filtros selecionados.'}
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCarnePayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {payment.description}
                        {payment.installment_number && (
                          <Badge variant="outline" className="text-xs">
                            Parcela {payment.installment_number}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{payment.guardian_name}</TableCell>
                    <TableCell>{formatDate(payment.due_date)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(payment.value)}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => onReceiveInCash(payment)}
                            disabled={processingPaymentId === payment.id || isAsaasLoading}
                          >
                            {processingPaymentId === payment.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <HandCoins className="w-4 h-4" />
                            )}
                            Baixa
                          </Button>
                        )}
                        {payment.status === 'OVERDUE' && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => onMarkAsConfirmed(payment)}
                            disabled={processingPaymentId === payment.id}
                          >
                            {processingPaymentId === payment.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Confirmar
                          </Button>
                        )}
                        {payment.asaas_payment_id && (payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            title="Ver/Enviar PIX"
                            onClick={() => onOpenPixModal(payment)}
                            className="gap-1"
                          >
                            <QrCode className="w-4 h-4" />
                            <span className="hidden sm:inline">PIX</span>
                          </Button>
                        )}
                        {payment.invoice_url && (
                          <Button variant="outline" size="sm" asChild title="Ver Boleto">
                            <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {payment.bank_slip_url && (
                          <Button variant="outline" size="sm" asChild title="Baixar PDF">
                            <a href={payment.bank_slip_url} target="_blank" rel="noopener noreferrer">
                              <Printer className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
