import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Calculator,
  Send,
  RefreshCw,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  Search
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Anticipation {
  id: string;
  status: string;
  anticipatedValue: number;
  totalValue: number;
  fee: number;
  netValue: number;
  requestDate: string;
  dueDate: string;
  paymentDate?: string;
  payment?: { id: string; description: string };
  installment?: string;
}

interface SimulationResult {
  anticipatedValue: number;
  fee: number;
  totalValue: number;
  isDocumentationRequired: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  PENDING: { label: 'Pendente', variant: 'secondary', icon: Clock },
  SCHEDULED: { label: 'Agendada', variant: 'default', icon: Calendar },
  CREDITED: { label: 'Creditada', variant: 'default', icon: CheckCircle2 },
  DENIED: { label: 'Negada', variant: 'destructive', icon: XCircle },
  CANCELLED: { label: 'Cancelada', variant: 'outline', icon: XCircle },
  OVERDUE: { label: 'Vencida', variant: 'destructive', icon: AlertCircle },
  DEBITED: { label: 'Debitada', variant: 'outline', icon: DollarSign },
};

export default function Anticipation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [simulationId, setSimulationId] = useState('');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [simulationType, setSimulationType] = useState<'payment' | 'installment'>('payment');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; failures: string[] } | null>(null);

  // Fetch pending payments from local database
  const { data: pendingPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['pending-payments-for-anticipation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          asaas_payment_id,
          asaas_installment_id,
          description,
          value,
          due_date,
          guardian_id,
          contract_id,
          guardians (name),
          contracts (zapsign_signed_pdf_url)
        `)
        .in('status', ['PENDING', 'CONFIRMED'])
        .not('asaas_payment_id', 'is', null)
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch carnes (installments groups) from local database
  const { data: pendingCarnes, isLoading: carnesLoading } = useQuery({
    queryKey: ['pending-carnes-for-anticipation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carnes')
        .select(`
          id,
          asaas_installment_id,
          description,
          total_value,
          installment_count,
          first_due_date,
          guardian_id,
          contract_id,
          guardians (name),
          contracts (zapsign_signed_pdf_url)
        `)
        .eq('status', 'ACTIVE')
        .order('first_due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Resolve signed contract PDF URL for the currently selected installment (carnê)
  const selectedContractPdfUrl = useMemo<string | null>(() => {
    if (simulationType !== 'installment' || !simulationId) return null;
    const c = pendingCarnes?.find(x => x.asaas_installment_id === simulationId);
    return (c?.contracts as { zapsign_signed_pdf_url: string | null } | null)?.zapsign_signed_pdf_url || null;
  }, [simulationId, simulationType, pendingCarnes]);

  const getPaymentContractUrl = (paymentId: string): string | null => {
    const p = pendingPayments?.find(x => x.asaas_payment_id === paymentId);
    return (p?.contracts as { zapsign_signed_pdf_url: string | null } | null)?.zapsign_signed_pdf_url || null;
  };

  // Filter items based on search term
  const filteredPayments = useMemo(() => {
    if (!pendingPayments) return [];
    if (!searchTerm) return pendingPayments;
    const term = searchTerm.toLowerCase();
    return pendingPayments.filter(p => 
      p.description?.toLowerCase().includes(term) ||
      (p.guardians as { name: string } | null)?.name?.toLowerCase().includes(term) ||
      p.asaas_payment_id?.toLowerCase().includes(term)
    );
  }, [pendingPayments, searchTerm]);

  const filteredCarnes = useMemo(() => {
    if (!pendingCarnes) return [];
    if (!searchTerm) return pendingCarnes;
    const term = searchTerm.toLowerCase();
    return pendingCarnes.filter(c => 
      c.description?.toLowerCase().includes(term) ||
      (c.guardians as { name: string } | null)?.name?.toLowerCase().includes(term) ||
      c.asaas_installment_id?.toLowerCase().includes(term)
    );
  }, [pendingCarnes, searchTerm]);

  // Fetch anticipation limits
  const { data: limits, isLoading: limitsLoading } = useQuery({
    queryKey: ['anticipation-limits'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('asaas-payment', {
        body: { action: 'getAnticipationLimits' }
      });
      if (error) throw error;
      return data;
    },
  });

  // Fetch anticipations list
  const { data: anticipations, isLoading: anticipationsLoading, refetch } = useQuery({
    queryKey: ['anticipations', statusFilter],
    queryFn: async () => {
      const filters: Record<string, unknown> = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      
      const { data, error } = await supabase.functions.invoke('asaas-payment', {
        body: { action: 'listAnticipations', data: filters }
      });
      if (error) throw error;
      return data?.data || [];
    },
  });

  // Effective IDs to operate on
  const effectiveIds = simulationType === 'payment'
    ? selectedPaymentIds
    : (simulationId ? [simulationId] : []);

  // Simulate anticipation mutation - aggregates over multiple payments when needed
  const simulateMutation = useMutation({
    mutationFn: async () => {
      if (effectiveIds.length === 0) throw new Error('Selecione ao menos um item');

      const results = await Promise.all(effectiveIds.map(async (id) => {
        const payload = simulationType === 'payment' ? { payment: id } : { installment: id };
        const { data, error } = await supabase.functions.invoke('asaas-payment', {
          body: { action: 'simulateAnticipation', data: payload }
        });
        if (error) throw new Error(error.message || 'Erro desconhecido');
        if (data?.error) throw new Error(data.error);
        return data as SimulationResult;
      }));

      // Aggregate
      const aggregated: SimulationResult = {
        anticipatedValue: results.reduce((s, r) => s + (r.anticipatedValue || 0), 0),
        fee: results.reduce((s, r) => s + (r.fee || 0), 0),
        totalValue: results.reduce((s, r) => s + (r.totalValue || 0), 0),
        isDocumentationRequired: results.some(r => r.isDocumentationRequired),
      };
      return aggregated;
    },
    onSuccess: (data) => {
      setSimulationResult(data);
      toast({
        title: "Simulação realizada",
        description: `${effectiveIds.length} ${effectiveIds.length > 1 ? 'itens' : 'item'} • Líquido: R$ ${data.anticipatedValue?.toFixed(2) || '0.00'}`,
      });
    },
    onError: (error: Error) => {
      setSimulationResult(null);
      const isBoletoCarne = simulationType === 'installment' && /Cartão de Crédito/i.test(error.message);
      toast({
        title: "Antecipação não disponível",
        description: isBoletoCarne
          ? "Carnês de boleto/PIX só podem ser antecipados parcela a parcela. Mude para a aba 'Cobranças Avulsas' e selecione o boleto desejado."
          : error.message,
        variant: "destructive",
      });
    },
  });

  // Request anticipation mutation - sequentially per id, with progress
  const requestMutation = useMutation({
    mutationFn: async () => {
      if (effectiveIds.length === 0) throw new Error('Nenhum item selecionado');
      setBulkProgress({ current: 0, total: effectiveIds.length, failures: [] });
      const failures: string[] = [];

      for (let i = 0; i < effectiveIds.length; i++) {
        const id = effectiveIds[i];
        const payload: Record<string, string> = simulationType === 'payment'
          ? { payment: id }
          : { installment: id };

        const pdf = simulationType === 'payment' ? getPaymentContractUrl(id) : selectedContractPdfUrl;
        if (pdf) payload.contractPdfUrl = pdf;

        try {
          const { data, error } = await supabase.functions.invoke('asaas-payment', {
            body: { action: 'requestAnticipation', data: payload }
          });
          if (error) throw new Error(error.message || 'Erro desconhecido');
          if (data?.error) throw new Error(data.error);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.push(`${id.substring(0, 8)}…: ${msg}`);
        }
        setBulkProgress({ current: i + 1, total: effectiveIds.length, failures: [...failures] });
      }

      return { total: effectiveIds.length, failures };
    },
    onSuccess: ({ total, failures }) => {
      const ok = total - failures.length;
      if (failures.length === 0) {
        toast({
          title: "Antecipação solicitada",
          description: `${ok} ${ok > 1 ? 'solicitações enviadas' : 'solicitação enviada'} para análise.`,
        });
      } else {
        toast({
          title: `${ok}/${total} solicitações enviadas`,
          description: failures.slice(0, 3).join(' • ') + (failures.length > 3 ? ` (+${failures.length - 3})` : ''),
          variant: failures.length === total ? "destructive" : "default",
        });
      }
      setShowConfirmDialog(false);
      setSimulationResult(null);
      setSimulationId('');
      setSelectedPaymentIds([]);
      setBulkProgress(null);
      queryClient.invalidateQueries({ queryKey: ['anticipations'] });
      queryClient.invalidateQueries({ queryKey: ['anticipation-limits'] });
      queryClient.invalidateQueries({ queryKey: ['pending-payments-for-anticipation'] });
    },
    onError: (error: Error) => {
      setBulkProgress(null);
      toast({
        title: "Erro na solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Antecipação de Recebíveis</h1>
          <p className="text-muted-foreground">Antecipe o recebimento de suas cobranças</p>
        </div>
        <Button variant="outline" onClick={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['anticipation-limits'] });
          queryClient.invalidateQueries({ queryKey: ['pending-payments-for-anticipation'] });
          queryClient.invalidateQueries({ queryKey: ['pending-carnes-for-anticipation'] });
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Limits Cards - Asaas anticipation limits per billing type */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Boleto / PIX
            </CardTitle>
          </CardHeader>
          <CardContent>
            {limitsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(limits?.bankSlip?.available || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disponível de {formatCurrency(limits?.bankSlip?.total || 0)}
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{
                      width: `${
                        limits?.bankSlip?.total
                          ? Math.min(100, ((limits.bankSlip.available || 0) / limits.bankSlip.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Taxa: <span className="font-medium text-foreground">5,79%</span></p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Cartão de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            {limitsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(limits?.creditCard?.available || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disponível de {formatCurrency(limits?.creditCard?.total || 0)}
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{
                      width: `${
                        limits?.creditCard?.total
                          ? Math.min(100, ((limits.creditCard.available || 0) / limits.creditCard.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Taxa: <span className="font-medium text-foreground">1,25%</span></p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="simulate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="simulate" className="gap-2">
            <Calculator className="w-4 h-4" />
            Simular
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <FileText className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Simular Antecipação
              </CardTitle>
              <CardDescription>
                Selecione uma cobrança ou carnê para simular a antecipação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type selector and search */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={simulationType} 
                    onValueChange={(v) => {
                      setSimulationType(v as 'payment' | 'installment');
                      setSimulationId('');
                      setSelectedPaymentIds([]);
                      setSimulationResult(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Cobranças Avulsas
                        </div>
                      </SelectItem>
                      <SelectItem value="installment">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Carnês (Parcelamentos)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Selectable list */}
              {simulationType === 'installment' && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    O Asaas só permite antecipar o carnê inteiro quando a forma de pagamento é <strong>Cartão de Crédito</strong>.
                    Para carnês de boleto/PIX, vá em <strong>Cobranças Avulsas</strong> e antecipe parcela por parcela.
                  </span>
                </div>
              )}

              {/* Selectable list */}
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {simulationType === 'payment' ? (
                  paymentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : filteredPayments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma cobrança pendente encontrada</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                filteredPayments.length > 0 &&
                                filteredPayments.every(p => selectedPaymentIds.includes(p.asaas_payment_id || ''))
                              }
                              onCheckedChange={(checked) => {
                                const allIds = filteredPayments.map(p => p.asaas_payment_id || '').filter(Boolean);
                                if (checked) {
                                  setSelectedPaymentIds(prev => Array.from(new Set([...prev, ...allIds])));
                                } else {
                                  setSelectedPaymentIds(prev => prev.filter(id => !allIds.includes(id)));
                                }
                                setSimulationResult(null);
                              }}
                              aria-label="Selecionar todas"
                            />
                          </TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment) => {
                          const pid = payment.asaas_payment_id || '';
                          const isChecked = selectedPaymentIds.includes(pid);
                          return (
                            <TableRow 
                              key={payment.id}
                              className={`cursor-pointer transition-colors ${isChecked ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                              onClick={() => {
                                setSelectedPaymentIds(prev =>
                                  isChecked ? prev.filter(id => id !== pid) : [...prev, pid]
                                );
                                setSimulationResult(null);
                              }}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    setSelectedPaymentIds(prev =>
                                      checked ? [...prev, pid] : prev.filter(id => id !== pid)
                                    );
                                    setSimulationResult(null);
                                  }}
                                  aria-label="Selecionar cobrança"
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {(payment.guardians as { name: string } | null)?.name || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.description || '-'}
                              </TableCell>
                              <TableCell>
                                {format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(payment.value)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )
                ) : (
                  carnesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : filteredCarnes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum carnê ativo encontrado</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Parcelas</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCarnes.map((carne) => (
                          <TableRow 
                            key={carne.id}
                            className={`cursor-pointer transition-colors ${simulationId === carne.asaas_installment_id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                            onClick={() => {
                              setSimulationId(carne.asaas_installment_id || '');
                              setSimulationResult(null);
                            }}
                          >
                            <TableCell>
                              <div className={`w-4 h-4 rounded-full border-2 ${simulationId === carne.asaas_installment_id ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                {simulationId === carne.asaas_installment_id && (
                                  <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {(carne.guardians as { name: string } | null)?.name || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {carne.description || '-'}
                            </TableCell>
                            <TableCell>
                              {carne.installment_count}x
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(carne.total_value)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}
              </div>

              {/* Simulate button */}
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {effectiveIds.length > 0
                    ? `${effectiveIds.length} ${effectiveIds.length > 1 ? 'itens selecionados' : 'item selecionado'}`
                    : 'Nenhum item selecionado'}
                </p>
                <Button
                  onClick={() => simulateMutation.mutate()}
                  disabled={effectiveIds.length === 0 || simulateMutation.isPending}
                  size="lg"
                >
                  {simulateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="w-4 h-4 mr-2" />
                  )}
                  Simular Antecipação
                </Button>
              </div>

              {simulationResult && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Resultado da Simulação
                  </h4>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-xl font-semibold">{formatCurrency(simulationResult.totalValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Taxa</p>
                      <p className="text-xl font-semibold text-destructive">- {formatCurrency(simulationResult.fee)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Líquido</p>
                      <p className="text-xl font-semibold text-green-600">{formatCurrency(simulationResult.anticipatedValue)}</p>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={() => setShowConfirmDialog(true)}
                        className="w-full"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Solicitar
                      </Button>
                    </div>
                  </div>
                  
                  {simulationResult.isDocumentationRequired && (() => {
                    const hasContract = simulationType === 'payment'
                      ? selectedPaymentIds.every(id => !!getPaymentContractUrl(id))
                      : !!selectedContractPdfUrl;
                    const partialContract = simulationType === 'payment'
                      && !hasContract
                      && selectedPaymentIds.some(id => !!getPaymentContractUrl(id));
                    return (
                      <div className={`mt-4 p-3 rounded-lg border ${hasContract ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                        <p className={`text-sm flex items-center gap-2 ${hasContract ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                          {hasContract ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          {hasContract
                            ? <><strong>Contratos assinados disponíveis:</strong> serão enviados automaticamente em cada solicitação.</>
                            : partialContract
                              ? <><strong>Contratos parciais:</strong> alguns itens não possuem contrato assinado. Estes podem ser negados.</>
                              : <><strong>Documentação obrigatória:</strong> nenhum contrato assinado encontrado. As solicitações podem ser negadas.</>}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Antecipações</CardTitle>
                  <CardDescription>Acompanhe suas solicitações de antecipação</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="SCHEDULED">Agendada</SelectItem>
                    <SelectItem value="CREDITED">Creditada</SelectItem>
                    <SelectItem value="DENIED">Negada</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {anticipationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !anticipations?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma antecipação encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Data Solicitação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(anticipations as Anticipation[]).map((item) => {
                      const config = statusConfig[item.status] || statusConfig.PENDING;
                      const StatusIcon = config.icon;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.id.substring(0, 8)}...</TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <StatusIcon className="w-3 h-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.totalValue)}</TableCell>
                          <TableCell className="text-destructive">- {formatCurrency(item.fee)}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(item.anticipatedValue || item.netValue)}
                          </TableCell>
                          <TableCell>
                            {item.requestDate && format(new Date(item.requestDate), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Antecipação</DialogTitle>
            <DialogDescription>
              Você está prestes a solicitar uma antecipação. Esta ação está sujeita a análise.
            </DialogDescription>
          </DialogHeader>
          
          {simulationResult && (
            <div className="py-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total:</span>
                <span className="font-semibold">{formatCurrency(simulationResult.totalValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa de antecipação:</span>
                <span className="font-semibold text-destructive">- {formatCurrency(simulationResult.fee)}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-semibold">Valor a receber:</span>
                <span className="font-bold text-green-600">{formatCurrency(simulationResult.anticipatedValue)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Confirmar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
