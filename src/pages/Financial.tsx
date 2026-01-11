import { useState, useMemo, useEffect } from 'react';
import { Wallet, TrendingUp, Calendar, AlertTriangle, CheckCircle2, Clock, Users, CalendarDays, Download, RefreshCw, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, isToday, parseISO, isBefore, startOfDay } from 'date-fns';
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
}

interface PaymentWithGuardian extends Payment {
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
}

export default function Financial() {
  const { guardians, carnes } = useSchool();
  const [payments, setPayments] = useState<PaymentWithGuardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

  // Calculate financial metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Payments for current month
    const monthPayments = payments.filter(p => {
      const dueDate = parseISO(p.due_date);
      return dueDate >= currentMonthStart && dueDate <= currentMonthEnd;
    });

    // Paid this month
    const paidThisMonth = payments.filter(p => {
      if (!p.payment_date) return false;
      const paymentDate = parseISO(p.payment_date);
      return paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd;
    });

    // Overdue today
    const overdueToday = payments.filter(p => {
      const dueDate = parseISO(p.due_date);
      return isToday(dueDate) && p.status !== 'RECEIVED' && p.status !== 'CONFIRMED';
    });

    // All overdue (past due date and not paid)
    const allOverdue = payments.filter(p => {
      const dueDate = parseISO(p.due_date);
      return isBefore(dueDate, today) && p.status !== 'RECEIVED' && p.status !== 'CONFIRMED';
    });

    // Pending this month
    const pendingThisMonth = monthPayments.filter(p => 
      p.status === 'PENDING' || p.status === 'OVERDUE'
    );

    // Expected revenue (all pending for current and future months)
    const expectedRevenue = payments
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.value, 0);

    // Received total
    const receivedTotal = payments
      .filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED')
      .reduce((sum, p) => sum + p.value, 0);

    // Monthly forecast (expected for current month)
    const monthlyForecast = monthPayments.reduce((sum, p) => sum + p.value, 0);
    const monthlyReceived = paidThisMonth.reduce((sum, p) => sum + p.value, 0);

    return {
      monthPayments,
      paidThisMonth,
      overdueToday,
      allOverdue,
      pendingThisMonth,
      expectedRevenue,
      receivedTotal,
      monthlyForecast,
      monthlyReceived,
      overdueTotal: allOverdue.reduce((sum, p) => sum + p.value, 0),
    };
  }, [payments, today, currentMonthStart, currentMonthEnd]);

  // Group overdue by guardian for debtors view
  const debtorsByGuardian = useMemo(() => {
    const grouped = metrics.allOverdue.reduce((acc, payment) => {
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
  }, [metrics.allOverdue]);

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
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet className="w-7 h-7" />
            Financeiro
          </h1>
          <p className="page-subtitle">Visão geral e previsibilidade financeira</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPayments} disabled={isLoading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Atualizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Previsão do Mês</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.monthlyForecast)}</p>
                <p className="text-xs text-muted-foreground">{metrics.monthPayments.length} mensalidades</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Recebido no Mês</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.monthlyReceived)}</p>
                <p className="text-xs text-muted-foreground">{metrics.paidThisMonth.length} pagamentos</p>
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
                <p className="text-sm text-muted-foreground">Pendente no Mês</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(metrics.monthlyForecast - metrics.monthlyReceived)}</p>
                <p className="text-xs text-muted-foreground">{metrics.pendingThisMonth.length} aguardando</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total em Atraso</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(metrics.overdueTotal)}</p>
                <p className="text-xs text-muted-foreground">{metrics.allOverdue.length} vencidos</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Pagos do Mês
          </TabsTrigger>
          <TabsTrigger value="debtors-today" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Vencendo Hoje
          </TabsTrigger>
          <TabsTrigger value="debtors-month" className="gap-2">
            <Users className="w-4 h-4" />
            Devedores
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expected Revenue Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Previsão de Receita</CardTitle>
                <CardDescription>Valores esperados para os próximos meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[0, 1, 2].map(monthOffset => {
                    const targetDate = new Date();
                    targetDate.setMonth(targetDate.getMonth() + monthOffset);
                    const monthStart = startOfMonth(targetDate);
                    const monthEnd = endOfMonth(targetDate);
                    
                    const monthPayments = payments.filter(p => {
                      const dueDate = parseISO(p.due_date);
                      return dueDate >= monthStart && dueDate <= monthEnd;
                    });
                    
                    const total = monthPayments.reduce((sum, p) => sum + p.value, 0);
                    const paid = monthPayments.filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED').reduce((sum, p) => sum + p.value, 0);
                    const percentage = total > 0 ? (paid / total) * 100 : 0;

                    return (
                      <div key={monthOffset} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium capitalize">
                            {format(targetDate, 'MMMM yyyy', { locale: ptBR })}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrency(paid)} / {formatCurrency(total)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo de Carnês</CardTitle>
                <CardDescription>Carnês ativos no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Total de Carnês</p>
                        <p className="text-sm text-muted-foreground">Cadastrados no sistema</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold">{carnes.length}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">Carnês Ativos</p>
                        <p className="text-sm text-muted-foreground">Em dia com pagamentos</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold">{carnes.filter(c => c.status === 'ACTIVE').length}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <p className="font-medium">Valor Total em Carnês</p>
                        <p className="text-sm text-muted-foreground">Soma de todos os carnês</p>
                      </div>
                    </div>
                    <span className="text-xl font-bold">{formatCurrency(carnes.reduce((sum, c) => sum + c.total_value, 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Devedores - Total em Atraso: {formatCurrency(metrics.overdueTotal)}
              </CardTitle>
              <CardDescription>
                {debtorsByGuardian.length} responsáveis com {metrics.allOverdue.length} mensalidades em atraso
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debtorsByGuardian.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma mensalidade em atraso! 🎉
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
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
