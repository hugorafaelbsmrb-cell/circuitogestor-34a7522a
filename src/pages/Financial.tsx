import { useState, useMemo, useEffect, useRef } from 'react';
import { Wallet, TrendingUp, Calendar, AlertTriangle, CheckCircle2, Clock, Users, CalendarDays, Download, RefreshCw, ExternalLink, FileText, Printer, Filter, HandCoins, Loader2, QrCode, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, isToday, parseISO, isBefore, startOfDay, isAfter, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { PixQrCodeModal } from '@/components/financial/PixQrCodeModal';
import { EntryBoletosSection } from '@/components/financial/EntryBoletosSection';
import { CarneInstallmentsSection } from '@/components/financial/CarneInstallmentsSection';
import { CreateBoletoModal } from '@/components/financial/CreateBoletoModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
}

interface PaymentWithGuardian extends Payment {
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
}

const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] as const;

export default function Financial() {
  const { guardians, carnes } = useSchool();
  const { receiveInCash, deletePayment, isLoading: isAsaasLoading } = useAsaasPayment();
  const [payments, setPayments] = useState<PaymentWithGuardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  
  // PIX Modal state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [selectedPaymentForPix, setSelectedPaymentForPix] = useState<PaymentWithGuardian | null>(null);
  
  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{ type: 'confirm' | 'cash'; payment: PaymentWithGuardian } | null>(null);
  
  // Create Boleto Modal state
  const [createBoletoModalOpen, setCreateBoletoModalOpen] = useState(false);
  
  // Debtors filter state
  const [debtorPeriodFilter, setDebtorPeriodFilter] = useState('all');
  const [debtorStartDate, setDebtorStartDate] = useState('');
  const [debtorEndDate, setDebtorEndDate] = useState('');
  const debtorsPrintRef = useRef<HTMLDivElement>(null);

  // Status filter for all payments tab
  const [entryStatusFilter, setEntryStatusFilter] = useState('all');
  const [carneStatusFilter, setCarneStatusFilter] = useState('all');
  
  // Month filter for carnês (default to current month)
  const [carneMonthFilter, setCarneMonthFilter] = useState(() => format(new Date(), 'yyyy-MM'));

  const handleOpenPixModal = (payment: PaymentWithGuardian) => {
    if (!payment.asaas_payment_id) {
      toast.error('Este pagamento não possui ID do Asaas');
      return;
    }
    setSelectedPaymentForPix(payment);
    setPixModalOpen(true);
  };

  // Fetch payments from database
  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Map payments with guardian info
      const paymentsWithGuardians = (data || []).map(payment => {
        const guardian = guardians.find(g => g.id === payment.guardian_id);
        return {
          ...payment,
          guardian_name: guardian?.name || 'Responsável não encontrado',
          guardian_phone: guardian?.phone || '',
          guardian_email: guardian?.email || '',
        };
      });

      setPayments(paymentsWithGuardians);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync payment statuses with Asaas API
  const syncPaymentsWithAsaas = async () => {
    setIsSyncing(true);
    try {
      const response = await supabase.functions.invoke('asaas-sync-payments', {
        body: { limit: 20 }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const data = response.data;
      
      if (data.updated > 0) {
        toast.success(`${data.updated} pagamentos atualizados!`);
        await fetchPayments(); // Refresh the list
      } else if (data.errors && data.errors.length > 0) {
        toast.warning(`Não foi possível sincronizar. Erros de API.`);
      } else {
        toast.info('Todos os pagamentos já estão sincronizados');
      }
    } catch (error) {
      console.error('Error syncing payments:', error);
      toast.error('Erro ao sincronizar pagamentos com Asaas');
    } finally {
      setIsSyncing(false);
    }
  };

  // Prompt confirmation before marking as confirmed
  const promptConfirmPayment = (payment: PaymentWithGuardian) => {
    setConfirmAction({ type: 'confirm', payment });
  };

  // Prompt confirmation before receiving in cash
  const promptReceiveInCash = (payment: PaymentWithGuardian) => {
    setConfirmAction({ type: 'cash', payment });
  };

  const handleConfirmActionExecute = async () => {
    if (!confirmAction) return;
    const { type, payment } = confirmAction;
    setConfirmAction(null);
    if (type === 'confirm') {
      await handleMarkAsConfirmed(payment);
    } else {
      await handleReceiveInCash(payment);
    }
  };

  // Mark payment as confirmed locally (when API sync fails)
  const handleMarkAsConfirmed = async (payment: PaymentWithGuardian) => {
    setProcessingPaymentId(payment.id);
    
    try {
      const { error } = await supabase
        .from('payments')
        .update({ 
          status: 'CONFIRMED', 
          payment_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
      
      if (error) throw error;
      
      // Update local state
      setPayments(prev => prev.map(p => 
        p.id === payment.id 
          ? { ...p, status: 'CONFIRMED', payment_date: new Date().toISOString().split('T')[0] }
          : p
      ));
      
      toast.success('Pagamento marcado como confirmado!');
    } catch (error) {
      console.error('Error marking as confirmed:', error);
      toast.error('Erro ao atualizar pagamento');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  // Handle manual payment receipt (baixa manual)
  const handleReceiveInCash = async (payment: PaymentWithGuardian) => {
    if (!payment.asaas_payment_id) {
      toast.error('Este pagamento não possui ID do Asaas');
      return;
    }
    
    setProcessingPaymentId(payment.id);
    
    try {
      const success = await receiveInCash(payment.asaas_payment_id);
      
      if (success) {
        // Update local state
        setPayments(prev => prev.map(p => 
          p.id === payment.id 
            ? { ...p, status: 'RECEIVED', payment_date: new Date().toISOString().split('T')[0] }
            : p
        ));
        
        // Update in database
        await supabase
          .from('payments')
          .update({ 
            status: 'RECEIVED', 
            payment_date: new Date().toISOString().split('T')[0] 
          })
          .eq('id', payment.id);
        
        toast.success('Baixa realizada com sucesso!');
      }
    } catch (error) {
      console.error('Error receiving in cash:', error);
      toast.error('Erro ao dar baixa no pagamento');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  // Handle delete payment (entry boleto)
  const handleDeletePayment = async (payment: PaymentWithGuardian) => {
    if (!payment.asaas_payment_id) {
      toast.error('Este pagamento não possui ID do Asaas');
      return;
    }
    
    setProcessingPaymentId(payment.id);
    
    try {
      const success = await deletePayment(payment.asaas_payment_id);
      
      if (success) {
        // Delete from local database
        await supabase
          .from('payments')
          .delete()
          .eq('id', payment.id);
        
        // Update local state
        setPayments(prev => prev.filter(p => p.id !== payment.id));
        
        toast.success('Boleto excluído com sucesso!');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Erro ao excluir boleto');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  useEffect(() => {
    if (guardians.length > 0) {
      fetchPayments();
    }
  }, [guardians]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const today = startOfDay(new Date());
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);

  // Calculate carnê-based predictability metrics
  const carneMetrics = useMemo(() => {
    const now = new Date();
    
    // Calculate expected revenue from carnês for next 6 months
    const monthlyForecast: { month: Date; expected: number; carneCount: number }[] = [];
    
    for (let i = 0; i < 6; i++) {
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() + i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);
      
      let expectedForMonth = 0;
      let carneCountForMonth = 0;
      
      carnes.forEach(carne => {
        const firstDueDate = parseISO(carne.first_due_date);
        const installmentValue = carne.total_value / carne.installment_count;
        
        // Calculate which installments fall in this month
        for (let inst = 0; inst < carne.installment_count; inst++) {
          const installmentDate = new Date(firstDueDate);
          installmentDate.setMonth(installmentDate.getMonth() + inst);
          
          if (installmentDate >= monthStart && installmentDate <= monthEnd) {
            expectedForMonth += installmentValue;
            carneCountForMonth++;
          }
        }
      });
      
      monthlyForecast.push({
        month: targetDate,
        expected: expectedForMonth,
        carneCount: carneCountForMonth,
      });
    }

    // Total value of all active carnês
    const totalCarneValue = carnes.reduce((sum, c) => sum + c.total_value, 0);
    
    // Active carnês count
    const activeCarnes = carnes.filter(c => c.status === 'ACTIVE').length;
    
    // Average ticket (valor médio por carnê)
    const averageTicket = carnes.length > 0 ? totalCarneValue / carnes.length : 0;
    
    // Total installments expected
    const totalInstallments = carnes.reduce((sum, c) => sum + c.installment_count, 0);

    return {
      monthlyForecast,
      totalCarneValue,
      activeCarnes,
      averageTicket,
      totalInstallments,
      totalCarnes: carnes.length,
    };
  }, [carnes]);

  // Separate entry boletos from carnê installments
  const { entryBoletos, carnePayments, filteredEntryBoletos } = useMemo(() => {
    const entry: PaymentWithGuardian[] = [];
    const carne: PaymentWithGuardian[] = [];
    
    payments.forEach(p => {
      const isEntry = p.description.toLowerCase().includes('entrada') || 
                      p.description.toLowerCase().includes('pro-rata') ||
                      p.description.toLowerCase().includes('pró-rata') ||
                      p.installment_number === null;
      
      if (isEntry) {
        entry.push(p);
      } else {
        carne.push(p);
      }
    });

    // Apply status filter for entry boletos only (carnês are filtered in component)
    const filteredEntry = entryStatusFilter === 'all' 
      ? entry 
      : entry.filter(p => p.status === entryStatusFilter);
    
    return { 
      entryBoletos: entry, 
      carnePayments: carne, 
      filteredEntryBoletos: filteredEntry
    };
  }, [payments, entryStatusFilter]);

  // Calculate financial metrics from payments
  const metrics = useMemo(() => {
    // Payments for current month
    const monthPayments = payments.filter(p => {
      const dueDate = parseISO(p.due_date);
      return dueDate >= currentMonthStart && dueDate <= currentMonthEnd;
    });

    // Boletos do mês que já foram pagos (mesma base da previsão)
    const paidThisMonth = monthPayments.filter(p => PAID_STATUSES.includes(p.status));

    // Boletos do mês ainda pendentes (não pagos)
    const pendingThisMonth = monthPayments.filter(p => !PAID_STATUSES.includes(p.status));

    // Overdue today
    const overdueToday = payments.filter(p => {
      const dueDate = parseISO(p.due_date);
      return isToday(dueDate) && !PAID_STATUSES.includes(p.status);
    });

    // All overdue (past due date and not paid)
    const allOverdue = payments.filter(p => {
      const dueDate = parseISO(p.due_date);
      return isBefore(dueDate, today) && !PAID_STATUSES.includes(p.status);
    });

    // Previsão = total de boletos com vencimento neste mês
    const monthlyForecast = monthPayments.reduce((sum, p) => sum + p.value, 0);
    // Recebido = boletos do mês já pagos
    const monthlyReceived = paidThisMonth.reduce((sum, p) => sum + p.value, 0);
    // Pendente = boletos do mês ainda em aberto
    const monthlyPending = pendingThisMonth.reduce((sum, p) => sum + p.value, 0);

    return {
      monthPayments,
      paidThisMonth,
      overdueToday,
      allOverdue,
      pendingThisMonth,
      monthlyForecast,
      monthlyReceived,
      monthlyPending,
      overdueTotal: allOverdue.reduce((sum, p) => sum + p.value, 0),
    };
  }, [payments, today, currentMonthStart, currentMonthEnd]);

  const overviewMetrics = useMemo(() => {
    const currentMonthForecast = carneMetrics.monthlyForecast[0];

    const receivedPayments = payments.filter(p => {
      if (!p.payment_date || !PAID_STATUSES.includes(p.status)) return false;

      const paymentDate = parseISO(p.payment_date);
      return paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd;
    });

    const receivedAmount = receivedPayments.reduce((sum, p) => sum + p.value, 0);
    const forecastAmount = currentMonthForecast?.expected ?? 0;
    const forecastInstallments = currentMonthForecast?.carneCount ?? 0;

    return {
      forecastAmount,
      forecastInstallments,
      receivedPayments,
      receivedAmount,
      pendingAmount: Math.max(forecastAmount - receivedAmount, 0),
      remainingInstallments: Math.max(forecastInstallments - receivedPayments.length, 0),
    };
  }, [carneMetrics.monthlyForecast, payments, currentMonthStart, currentMonthEnd]);

  // Filter overdue payments by period
  const filteredOverdue = useMemo(() => {
    let result = metrics.allOverdue;
    
    if (debtorPeriodFilter === 'custom' && debtorStartDate && debtorEndDate) {
      const start = parseISO(debtorStartDate);
      const end = parseISO(debtorEndDate);
      result = result.filter(p => {
        const dueDate = parseISO(p.due_date);
        return isWithinInterval(dueDate, { start, end });
      });
    } else if (debtorPeriodFilter === 'last7') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(p => {
        const dueDate = parseISO(p.due_date);
        return isAfter(dueDate, sevenDaysAgo) && isBefore(dueDate, today);
      });
    } else if (debtorPeriodFilter === 'last30') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter(p => {
        const dueDate = parseISO(p.due_date);
        return isAfter(dueDate, thirtyDaysAgo) && isBefore(dueDate, today);
      });
    } else if (debtorPeriodFilter === 'last90') {
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      result = result.filter(p => {
        const dueDate = parseISO(p.due_date);
        return isAfter(dueDate, ninetyDaysAgo) && isBefore(dueDate, today);
      });
    } else if (debtorPeriodFilter === 'currentMonth') {
      result = result.filter(p => {
        const dueDate = parseISO(p.due_date);
        return dueDate >= currentMonthStart && dueDate <= currentMonthEnd;
      });
    }
    
    return result;
  }, [metrics.allOverdue, debtorPeriodFilter, debtorStartDate, debtorEndDate, today, currentMonthStart, currentMonthEnd]);

  // Group filtered overdue by guardian for debtors view
  const debtorsByGuardian = useMemo(() => {
    const grouped = filteredOverdue.reduce((acc, payment) => {
      if (!acc[payment.guardian_id]) {
        acc[payment.guardian_id] = {
          guardian_id: payment.guardian_id,
          guardian_name: payment.guardian_name,
          guardian_phone: payment.guardian_phone,
          guardian_email: payment.guardian_email,
          payments: [],
          totalDebt: 0,
        };
      }
      acc[payment.guardian_id].payments.push(payment);
      acc[payment.guardian_id].totalDebt += payment.value;
      return acc;
    }, {} as Record<string, { guardian_id: string; guardian_name: string; guardian_phone: string; guardian_email: string; payments: PaymentWithGuardian[]; totalDebt: number }>);

    return Object.values(grouped).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [filteredOverdue]);

  const filteredOverdueTotal = useMemo(() => {
    return filteredOverdue.reduce((sum, p) => sum + p.value, 0);
  }, [filteredOverdue]);

  const handlePrintDebtors = () => {
    const printContent = debtorsPrintRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    const periodText = debtorPeriodFilter === 'all' 
      ? 'Todos os períodos' 
      : debtorPeriodFilter === 'last7' 
        ? 'Últimos 7 dias'
        : debtorPeriodFilter === 'last30'
          ? 'Últimos 30 dias'
          : debtorPeriodFilter === 'last90'
            ? 'Últimos 90 dias'
            : debtorPeriodFilter === 'currentMonth'
              ? format(new Date(), 'MMMM yyyy', { locale: ptBR })
              : `${debtorStartDate} a ${debtorEndDate}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Devedores</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            h2 { font-size: 18px; color: #666; margin-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary p { margin: 5px 0; }
            .debtor { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
            .debtor-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
            .debtor-name { font-weight: bold; font-size: 16px; }
            .debtor-total { color: #dc2626; font-weight: bold; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
            th { background: #f9f9f9; font-weight: 600; }
            .text-right { text-align: right; }
            .badge { background: #fecaca; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
            @media print {
              body { padding: 0; }
              .debtor { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Relatório de Devedores</h1>
          <h2>Período: ${periodText}</h2>
          <div class="summary">
            <p><strong>Total de responsáveis:</strong> ${debtorsByGuardian.length}</p>
            <p><strong>Total de parcelas em atraso:</strong> ${filteredOverdue.length}</p>
            <p><strong>Valor total em atraso:</strong> ${formatCurrency(filteredOverdueTotal)}</p>
            <p><strong>Data do relatório:</strong> ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
          ${debtorsByGuardian.map(debtor => `
            <div class="debtor">
              <div class="debtor-header">
                <div>
                  <div class="debtor-name">${debtor.guardian_name}</div>
                  <div style="color: #666; font-size: 14px;">${debtor.guardian_phone} | ${debtor.guardian_email}</div>
                </div>
                <div>
                  <div class="debtor-total">${formatCurrency(debtor.totalDebt)}</div>
                  <div style="color: #666; font-size: 12px;">${debtor.payments.length} parcelas</div>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Vencimento</th>
                    <th>Dias Atraso</th>
                    <th class="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${debtor.payments.map(payment => {
                    const dueDate = parseISO(payment.due_date);
                    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    return `
                      <tr>
                        <td>${payment.description}</td>
                        <td>${formatDate(payment.due_date)}</td>
                        <td><span class="badge">${daysOverdue} dias</span></td>
                        <td class="text-right">${formatCurrency(payment.value)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      PENDING: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      RECEIVED: { label: 'Pago', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      CONFIRMED: { label: 'Confirmado', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      OVERDUE: { label: 'Vencido', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    const config = configs[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet className="w-5 h-5 lg:w-7 lg:h-7" />
            Financeiro
          </h1>
          <p className="page-subtitle">Visão geral e previsibilidade financeira</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCreateBoletoModalOpen(true)} size="sm" className="gap-2 flex-1 sm:flex-none">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Boleto Avulso</span>
          </Button>
          <Button variant="outline" size="sm" onClick={syncPaymentsWithAsaas} disabled={isSyncing || isLoading} className="gap-2 flex-1 sm:flex-none">
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            <span className="hidden sm:inline">Sincronizar Asaas</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPayments} disabled={isLoading} className="gap-2 flex-1 sm:flex-none">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardContent className="p-3 lg:pt-6 lg:px-6">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 lg:space-y-1 min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Previsão do Mês</p>
                <p className="text-lg lg:text-2xl font-bold">{formatCurrency(metrics.monthlyForecast)}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">{metrics.monthPayments.length} mensalidades</p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:pt-6 lg:px-6">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 lg:space-y-1 min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Recebido no Mês</p>
                <p className="text-lg lg:text-2xl font-bold text-green-600">{formatCurrency(metrics.monthlyReceived)}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">{metrics.paidThisMonth.length} pagamentos</p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:pt-6 lg:px-6">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 lg:space-y-1 min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Pendente no Mês</p>
                <p className="text-lg lg:text-2xl font-bold text-yellow-600">{formatCurrency(metrics.monthlyPending)}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">{metrics.pendingThisMonth.length} aguardando</p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 lg:w-5 lg:h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:pt-6 lg:px-6">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 lg:space-y-1 min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Total em Atraso</p>
                <p className="text-lg lg:text-2xl font-bold text-destructive">{formatCurrency(metrics.overdueTotal)}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">{metrics.allOverdue.length} vencidos</p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="all-payments" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Pagos</span>
          </TabsTrigger>
          <TabsTrigger value="debtors-today" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Hoje</span>
          </TabsTrigger>
          <TabsTrigger value="debtors-month" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Devedores</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Carnê-based forecast cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total em Carnês</p>
                    <p className="text-2xl font-bold">{formatCurrency(carneMetrics.totalCarneValue)}</p>
                    <p className="text-xs text-muted-foreground">{carneMetrics.totalCarnes} carnês gerados</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Carnês Ativos</p>
                    <p className="text-2xl font-bold">{carneMetrics.activeCarnes}</p>
                    <p className="text-xs text-muted-foreground">de {carneMetrics.totalCarnes} total</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Ticket Médio</p>
                    <p className="text-2xl font-bold">{formatCurrency(carneMetrics.averageTicket)}</p>
                    <p className="text-xs text-muted-foreground">valor médio por carnê</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Parcelas</p>
                    <p className="text-2xl font-bold">{carneMetrics.totalInstallments}</p>
                    <p className="text-xs text-muted-foreground">parcelas programadas</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Forecast from Carnês */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Previsão de Receita (Carnês)
                </CardTitle>
                <CardDescription>Valores esperados baseados nos carnês gerados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {carneMetrics.monthlyForecast.map((forecast, index) => {
                    // Find how much was already received for this month from payments
                    const monthStart = startOfMonth(forecast.month);
                    const monthEnd = endOfMonth(forecast.month);
                    const paidForMonth = payments
                      .filter(p => {
                        if (!p.payment_date) return false;
                        const paymentDate = parseISO(p.payment_date);
                        return paymentDate >= monthStart && paymentDate <= monthEnd;
                      })
                      .reduce((sum, p) => sum + p.value, 0);
                    
                    const percentage = forecast.expected > 0 ? Math.min((paidForMonth / forecast.expected) * 100, 100) : 0;
                    const isCurrentMonth = index === 0;

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className={cn("font-medium capitalize", isCurrentMonth && "text-primary")}>
                            {format(forecast.month, 'MMMM yyyy', { locale: ptBR })}
                            {isCurrentMonth && <Badge variant="outline" className="ml-2 text-xs">Atual</Badge>}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrency(paidForMonth)} / {formatCurrency(forecast.expected)}
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-300",
                              isCurrentMonth ? "bg-primary" : "bg-primary/60"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {forecast.carneCount} parcelas esperadas
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Carnê Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Detalhes dos Carnês
                </CardTitle>
                <CardDescription>Informações dos carnês cadastrados</CardDescription>
              </CardHeader>
              <CardContent>
                {carnes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum carnê cadastrado ainda.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {carnes.slice(0, 10).map((carne) => {
                      const guardian = guardians.find(g => g.id === carne.guardian_id);
                      const installmentValue = carne.total_value / carne.installment_count;
                      
                      return (
                        <div key={carne.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{carne.description}</p>
                            <p className="text-xs text-muted-foreground">{guardian?.name || 'Responsável não encontrado'}</p>
                            <p className="text-xs text-muted-foreground">
                              {carne.installment_count}x de {formatCurrency(installmentValue)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(carne.total_value)}</p>
                            <Badge 
                              variant="outline" 
                              className={carne.status === 'ACTIVE' 
                                ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                : 'bg-muted text-muted-foreground'
                              }
                            >
                              {carne.status === 'ACTIVE' ? 'Ativo' : carne.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                    {carnes.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground pt-2">
                        E mais {carnes.length - 10} carnês...
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Payments Tab */}
        <TabsContent value="all-payments" className="space-y-4">
          {/* Entry Boletos Section */}
          <EntryBoletosSection
            filteredEntryBoletos={filteredEntryBoletos}
            entryBoletos={entryBoletos}
            entryStatusFilter={entryStatusFilter}
            setEntryStatusFilter={setEntryStatusFilter}
            processingPaymentId={processingPaymentId}
            isAsaasLoading={isAsaasLoading}
            onReceiveInCash={promptReceiveInCash}
            onMarkAsConfirmed={promptConfirmPayment}
            onOpenPixModal={handleOpenPixModal}
            onDeletePayment={handleDeletePayment}
          />

          {/* Carnê Installments Section */}
          <CarneInstallmentsSection
            carnePayments={carnePayments}
            carneStatusFilter={carneStatusFilter}
            setCarneStatusFilter={setCarneStatusFilter}
            carneMonthFilter={carneMonthFilter}
            setCarneMonthFilter={setCarneMonthFilter}
            processingPaymentId={processingPaymentId}
            isAsaasLoading={isAsaasLoading}
            onReceiveInCash={promptReceiveInCash}
            onMarkAsConfirmed={promptConfirmPayment}
            onOpenPixModal={handleOpenPixModal}
          />
        </TabsContent>

        {/* Paid This Month Tab */}
        <TabsContent value="paid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Mensalidades Pagas em {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {metrics.paidThisMonth.length} pagamentos confirmados totalizando {formatCurrency(metrics.monthlyReceived)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.paidThisMonth.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum pagamento confirmado neste mês ainda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.paidThisMonth.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.description}</TableCell>
                        <TableCell>{payment.guardian_name}</TableCell>
                        <TableCell>{formatDate(payment.due_date)}</TableCell>
                        <TableCell>{payment.payment_date ? formatDate(payment.payment_date) : '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(payment.value)}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-right">
                          {payment.asaas_payment_id && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              title="Ver/Enviar PIX"
                              onClick={() => handleOpenPixModal(payment)}
                              className="gap-1"
                            >
                              <QrCode className="w-4 h-4" />
                              <span className="hidden sm:inline">PIX</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debtors Today Tab */}
        <TabsContent value="debtors-today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-yellow-500" />
                Vencimentos de Hoje - {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {metrics.overdueToday.length} mensalidades vencem hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.overdueToday.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum vencimento para hoje! 🎉
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.overdueToday.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.description}</TableCell>
                        <TableCell>{payment.guardian_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{payment.guardian_phone}</p>
                            <p className="text-muted-foreground">{payment.guardian_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(payment.value)}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-1"
                              onClick={() => promptReceiveInCash(payment)}
                              disabled={processingPaymentId === payment.id || isAsaasLoading}
                            >
                              {processingPaymentId === payment.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <HandCoins className="w-4 h-4" />
                              )}
                              Baixa
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="gap-1"
                              onClick={() => promptConfirmPayment(payment)}
                              disabled={processingPaymentId === payment.id}
                            >
                              {processingPaymentId === payment.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Confirmar
                            </Button>
                            {payment.asaas_payment_id && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                title="Ver/Enviar PIX"
                                onClick={() => handleOpenPixModal(payment)}
                                className="gap-1"
                              >
                                <QrCode className="w-4 h-4" />
                                <span className="hidden sm:inline">PIX</span>
                              </Button>
                            )}
                            {payment.invoice_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debtors Month Tab */}
        <TabsContent value="debtors-month" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Período
                  </Label>
                  <Select value={debtorPeriodFilter} onValueChange={setDebtorPeriodFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os vencidos</SelectItem>
                      <SelectItem value="last7">Últimos 7 dias</SelectItem>
                      <SelectItem value="last30">Últimos 30 dias</SelectItem>
                      <SelectItem value="last90">Últimos 90 dias</SelectItem>
                      <SelectItem value="currentMonth">Mês atual</SelectItem>
                      <SelectItem value="custom">Período personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {debtorPeriodFilter === 'custom' && (
                  <>
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <Input
                        type="date"
                        value={debtorStartDate}
                        onChange={(e) => setDebtorStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <Input
                        type="date"
                        value={debtorEndDate}
                        onChange={(e) => setDebtorEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
                
                <Button onClick={handlePrintDebtors} className="gap-2">
                  <Printer className="w-4 h-4" />
                  Imprimir Relatório
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Devedores - Total em Atraso: {formatCurrency(filteredOverdueTotal)}
              </CardTitle>
              <CardDescription>
                {debtorsByGuardian.length} responsáveis com {filteredOverdue.length} mensalidades em atraso
                {debtorPeriodFilter !== 'all' && (
                  <Badge variant="outline" className="ml-2">Filtro aplicado</Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={debtorsPrintRef}>
                {debtorsByGuardian.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma mensalidade em atraso para o período selecionado! 🎉
                  </div>
                ) : (
                  <div className="space-y-4">
                    {debtorsByGuardian.map((debtor) => (
                      <div key={debtor.guardian_id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{debtor.guardian_name}</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>{debtor.guardian_phone}</p>
                              <p>{debtor.guardian_email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-destructive">{formatCurrency(debtor.totalDebt)}</p>
                            <p className="text-sm text-muted-foreground">{debtor.payments.length} parcelas em atraso</p>
                          </div>
                        </div>
                        
                        <div className="border-t pt-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Dias Atraso</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {debtor.payments.map((payment) => {
                                const dueDate = parseISO(payment.due_date);
                                const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                                
                                return (
                                  <TableRow key={payment.id}>
                                    <TableCell className="font-medium">{payment.description}</TableCell>
                                    <TableCell>{formatDate(payment.due_date)}</TableCell>
                                    <TableCell>
                                      <Badge variant="destructive">{daysOverdue} dias</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(payment.value)}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="gap-1"
                                          onClick={() => promptReceiveInCash(payment)}
                                          disabled={processingPaymentId === payment.id || isAsaasLoading}
                                        >
                                          {processingPaymentId === payment.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <HandCoins className="w-4 h-4" />
                                          )}
                                          Baixa
                                        </Button>
                                        <Button 
                                          variant="default" 
                                          size="sm" 
                                          className="gap-1"
                                          onClick={() => promptConfirmPayment(payment)}
                                          disabled={processingPaymentId === payment.id}
                                        >
                                          {processingPaymentId === payment.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <CheckCircle2 className="w-4 h-4" />
                                          )}
                                          Confirmar
                                        </Button>
                                        {payment.asaas_payment_id && (
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            title="Ver/Enviar PIX"
                                            onClick={() => handleOpenPixModal(payment)}
                                            className="gap-1"
                                          >
                                            <QrCode className="w-4 h-4" />
                                            <span className="hidden sm:inline">PIX</span>
                                          </Button>
                                        )}
                                        {payment.invoice_url && (
                                          <Button variant="ghost" size="sm" asChild title="Ver Fatura">
                                            <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                                              <ExternalLink className="w-4 h-4" />
                                            </a>
                                          </Button>
                                        )}
                                        {payment.bank_slip_url && (
                                          <Button variant="ghost" size="sm" asChild title="Baixar Boleto PDF">
                                            <a href={payment.bank_slip_url} target="_blank" rel="noopener noreferrer">
                                              <Printer className="w-4 h-4" />
                                            </a>
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PIX QR Code Modal */}
      {selectedPaymentForPix && (
        <PixQrCodeModal
          isOpen={pixModalOpen}
          onClose={() => {
            setPixModalOpen(false);
            setSelectedPaymentForPix(null);
          }}
          paymentId={selectedPaymentForPix.asaas_payment_id || ''}
          paymentDescription={selectedPaymentForPix.description}
          paymentValue={selectedPaymentForPix.value}
          dueDate={selectedPaymentForPix.due_date}
          guardianName={selectedPaymentForPix.guardian_name}
          guardianPhone={selectedPaymentForPix.guardian_phone}
        />
      )}

      {/* Create Boleto Modal */}
      <CreateBoletoModal
        open={createBoletoModalOpen}
        onOpenChange={setCreateBoletoModalOpen}
        guardians={guardians.map(g => ({
          id: g.id,
          name: g.name,
          cpf: g.cpf,
          asaas_customer_id: g.asaas_customer_id || null,
        }))}
        onSuccess={fetchPayments}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'confirm' 
                ? `Tem certeza que deseja marcar o pagamento "${confirmAction?.payment.description}" de ${confirmAction?.payment.guardian_name} como confirmado? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja dar baixa manual no pagamento "${confirmAction?.payment.description}" de ${confirmAction?.payment.guardian_name}? Esta ação não pode ser desfeita.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmActionExecute}>
              {confirmAction?.type === 'confirm' ? 'Confirmar Pagamento' : 'Dar Baixa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
