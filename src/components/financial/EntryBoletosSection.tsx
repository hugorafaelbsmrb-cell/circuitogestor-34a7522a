import { ExternalLink, FileText, HandCoins, Loader2, CheckCircle2, QrCode, Printer, Calendar, User, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface EntryBoletosSectionProps {
  filteredEntryBoletos: Payment[];
  entryBoletos: Payment[];
  entryStatusFilter: string;
  setEntryStatusFilter: (value: string) => void;
  processingPaymentId: string | null;
  isAsaasLoading: boolean;
  onReceiveInCash: (payment: Payment) => void;
  onMarkAsConfirmed: (payment: Payment) => void;
  onOpenPixModal: (payment: Payment) => void;
  onDeletePayment?: (payment: Payment) => void;
}

export function EntryBoletosSection({
  filteredEntryBoletos,
  entryBoletos,
  entryStatusFilter,
  setEntryStatusFilter,
  processingPaymentId,
  isAsaasLoading,
  onReceiveInCash,
  onMarkAsConfirmed,
  onOpenPixModal,
  onDeletePayment,
}: EntryBoletosSectionProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const today = startOfDay(new Date());

  const getStatusConfig = (status: string, dueDate: string) => {
    const isOverdue = isBefore(parseISO(dueDate), today) && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status);
    
    if (isOverdue || status === 'OVERDUE') {
      return {
        label: 'Vencido',
        className: 'bg-destructive/10 text-destructive border-destructive/20',
        cardClassName: 'border-destructive/30 bg-destructive/5',
        icon: AlertTriangle,
      };
    }
    
    const configs: Record<string, { label: string; className: string; cardClassName: string; icon: typeof CheckCircle2 }> = {
      PENDING: { 
        label: 'Pendente', 
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        cardClassName: 'border-yellow-500/20 bg-yellow-500/5',
        icon: Clock,
      },
      RECEIVED: { 
        label: 'Pago', 
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
        cardClassName: 'border-green-500/20 bg-green-500/5',
        icon: CheckCircle2,
      },
      CONFIRMED: { 
        label: 'Confirmado', 
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
        cardClassName: 'border-green-500/20 bg-green-500/5',
        icon: CheckCircle2,
      },
      RECEIVED_IN_CASH: { 
        label: 'Pago em Dinheiro', 
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
        cardClassName: 'border-green-500/20 bg-green-500/5',
        icon: CheckCircle2,
      },
    };
    
    return configs[status] || { 
      label: status, 
      className: 'bg-muted text-muted-foreground',
      cardClassName: '',
      icon: Clock,
    };
  };

  // Calculate summary stats
  const pendingCount = entryBoletos.filter(p => p.status === 'PENDING').length;
  const overdueCount = entryBoletos.filter(p => {
    const isOverdue = isBefore(parseISO(p.due_date), today) && !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
    return isOverdue || p.status === 'OVERDUE';
  }).length;
  const paidCount = entryBoletos.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)).length;
  const totalPendingValue = entryBoletos
    .filter(p => !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
    .reduce((sum, p) => sum + p.value, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-blue-500" />
              Boletos de Entrada
            </CardTitle>
            <CardDescription>
              {filteredEntryBoletos.length} de {entryBoletos.length} boletos de entrada/pro-rata
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini stats */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                {pendingCount} pendentes
              </Badge>
              {overdueCount > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {overdueCount} vencidos
                </Badge>
              )}
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                {paidCount} pagos
              </Badge>
            </div>
            <Select value={entryStatusFilter} onValueChange={setEntryStatusFilter}>
              <SelectTrigger className="w-[140px]">
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
        
        {/* Total pending value highlight */}
        {totalPendingValue > 0 && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <span className="font-medium">Total a receber:</span> {formatCurrency(totalPendingValue)} em {pendingCount + overdueCount} boletos
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredEntryBoletos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
            {entryBoletos.length === 0 
              ? 'Nenhum boleto de entrada cadastrado.' 
              : 'Nenhum boleto encontrado com o filtro selecionado.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-1">
            {filteredEntryBoletos.map((payment) => {
              const isProRata = payment.description.toLowerCase().includes('pro-rata') || 
                                payment.description.toLowerCase().includes('pró-rata');
              const statusConfig = getStatusConfig(payment.status, payment.due_date);
              const StatusIcon = statusConfig.icon;
              const isPending = payment.status === 'PENDING' || payment.status === 'OVERDUE';
              
              return (
                <div
                  key={payment.id}
                  className={cn(
                    "border rounded-xl p-4 transition-all hover:shadow-md",
                    statusConfig.cardClassName
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        statusConfig.className.split(' ')[0] // get bg color
                      )}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-lg truncate">{formatCurrency(payment.value)}</p>
                        <Badge variant="outline" className={cn("text-xs", statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>
                    {isProRata && (
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20 shrink-0">
                        Pro-Rata
                      </Badge>
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{payment.guardian_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Vence em {formatDate(payment.due_date)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate pl-5">
                      {payment.description}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
                    {isPending && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1 flex-1"
                          onClick={() => onReceiveInCash(payment)}
                          disabled={processingPaymentId === payment.id || isAsaasLoading}
                        >
                          {processingPaymentId === payment.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <HandCoins className="w-3.5 h-3.5" />
                          )}
                          Baixa
                        </Button>
                        {payment.status === 'OVERDUE' && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="gap-1 flex-1"
                            onClick={() => onMarkAsConfirmed(payment)}
                            disabled={processingPaymentId === payment.id}
                          >
                            {processingPaymentId === payment.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Confirmar
                          </Button>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      {payment.asaas_payment_id && isPending && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          title="Ver/Enviar PIX"
                          onClick={() => onOpenPixModal(payment)}
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                      )}
                      {payment.invoice_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver Boleto">
                          <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      {payment.bank_slip_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Baixar PDF">
                          <a href={payment.bank_slip_url} target="_blank" rel="noopener noreferrer">
                            <Printer className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      {isPending && onDeletePayment && payment.asaas_payment_id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Excluir Boleto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Boleto</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este boleto? Esta ação também cancelará a cobrança no Asaas.
                                <div className="mt-4 p-3 bg-muted rounded-lg space-y-1">
                                  <p><strong>Valor:</strong> {formatCurrency(payment.value)}</p>
                                  <p><strong>Vencimento:</strong> {formatDate(payment.due_date)}</p>
                                  <p><strong>Descrição:</strong> {payment.description}</p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeletePayment(payment)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
