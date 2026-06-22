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

interface SignedContractRef {
  id: string;
  zapsign_document_id: string | null;
  zapsign_signed_at: string | null;
  zapsign_signed_pdf_url: string | null;
  clicksign_envelope_id: string | null;
  clicksign_signed_at: string | null;
  clicksign_signed_pdf_url: string | null;
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
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);
  const [ineligible, setIneligible] = useState<{ id: string; reason: string }[]>([]);
  const [onlyWithContract, setOnlyWithContract] = useState(true);
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const resolveFreshContractPdfUrl = async (contract: SignedContractRef | null): Promise<string | null> => {
    if (!contract?.id) return null;

    if (contract.zapsign_document_id && (contract.zapsign_signed_at || contract.zapsign_signed_pdf_url)) {
      const { data, error } = await supabase.functions.invoke('zapsign-get-pdf', {
        body: { contractId: contract.id },
      });
      if (!error && data?.url) return data.url;
    }

    if (contract.clicksign_envelope_id && (contract.clicksign_signed_at || contract.clicksign_signed_pdf_url)) {
      const { data, error } = await supabase.functions.invoke('clicksign-get-pdf', {
        body: { contractId: contract.id },
      });
      if (!error && data?.url) return data.url;
    }

    return getStoredContractPdfUrl(contract);
  };

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
          contracts (
            id,
            zapsign_document_id,
            zapsign_signed_at,
            zapsign_signed_pdf_url,
            clicksign_envelope_id,
            clicksign_signed_at,
            clicksign_signed_pdf_url
          )
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
          contracts (
            id,
            zapsign_document_id,
            zapsign_signed_at,
            zapsign_signed_pdf_url,
            clicksign_envelope_id,
            clicksign_signed_at,
            clicksign_signed_pdf_url
          )
        `)
        .eq('status', 'ACTIVE')
        .order('first_due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Resolve signed contract PDF URL for the currently selected installment (carnê)
  const selectedContract = useMemo<SignedContractRef | null>(() => {
    if (simulationType !== 'installment' || !simulationId) return null;
    const c = pendingCarnes?.find(x => x.asaas_installment_id === simulationId);
    return (c?.contracts as SignedContractRef | null) || null;
  }, [simulationId, simulationType, pendingCarnes]);

  const getPaymentContract = (paymentId: string): SignedContractRef | null => {
    const p = pendingPayments?.find(x => x.asaas_payment_id === paymentId);
    return (p?.contracts as SignedContractRef | null) || null;
  };

  const getStoredContractPdfUrl = (contract: SignedContractRef | null): string | null => {
    if (!contract) return null;
    return contract.zapsign_signed_pdf_url || contract.clicksign_signed_pdf_url || null;
  };

  // Filter items based on search term and "only with contract" flag
  const hasSignedContract = (rec: { contracts?: unknown }) =>
    !!getStoredContractPdfUrl((rec?.contracts as SignedContractRef | null) || null)
    || !!(rec?.contracts as SignedContractRef | null)?.zapsign_signed_at
    || !!(rec?.contracts as SignedContractRef | null)?.clicksign_signed_at;

  // Asaas only allows anticipating payments with due date in the future.
  // The dueDateFilter lets the operator narrow by upcoming window (in days).
  const getMaxDueDate = (days: string): Date | null => {
    if (days === 'all') return null;
    const n = parseInt(days, 10);
    if (Number.isNaN(n)) return null;
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    d.setDate(d.getDate() + n);
    return d;
  };

  const isWithinDueWindow = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const max = getMaxDueDate(dueDateFilter);
    if (!max) return true;
    const due = new Date(`${dateStr}T00:00:00`);
    return due <= max;
  };

  const isWithinMonthFilter = (dateStr: string | null | undefined): boolean => {
    if (!dateStr || monthFilter === 'all') return true;
    const monthIndex = parseInt(monthFilter, 10);
    if (Number.isNaN(monthIndex)) return true;
    const due = new Date(`${dateStr}T00:00:00`);
    return due.getMonth() === monthIndex;
  };

  const filteredPayments = useMemo(() => {
    if (!pendingPayments) return [];
    let list = pendingPayments;
    if (onlyWithContract) list = list.filter(hasSignedContract);
    list = list.filter(p => isWithinDueWindow(p.due_date));
    list = list.filter(p => isWithinMonthFilter(p.due_date));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.description?.toLowerCase().includes(term) ||
        (p.guardians as { name: string } | null)?.name?.toLowerCase().includes(term) ||
        p.asaas_payment_id?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [pendingPayments, searchTerm, onlyWithContract, dueDateFilter, monthFilter]);

  const filteredCarnes = useMemo(() => {
    if (!pendingCarnes) return [];
    let list = pendingCarnes;
    if (onlyWithContract) list = list.filter(hasSignedContract);
    list = list.filter(c => isWithinDueWindow(c.first_due_date));
    list = list.filter(c => isWithinMonthFilter(c.first_due_date));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c =>
        c.description?.toLowerCase().includes(term) ||
        (c.guardians as { name: string } | null)?.name?.toLowerCase().includes(term) ||
        c.asaas_installment_id?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [pendingCarnes, searchTerm, onlyWithContract, dueDateFilter, monthFilter]);

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

  // Sum of selected items value (for limit comparison)
  const selectedTotal = useMemo(() => {
    if (simulationType === 'payment') {
      return (pendingPayments || [])
        .filter(p => selectedPaymentIds.includes(p.asaas_payment_id || ''))
        .reduce((s, p) => s + Number(p.value || 0), 0);
    }
    const c = pendingCarnes?.find(x => x.asaas_installment_id === simulationId);
    return Number(c?.total_value || 0);
  }, [simulationType, selectedPaymentIds, simulationId, pendingPayments, pendingCarnes]);

  // Relevant Asaas limit (boletos/pix => bankSlip)
  const relevantLimit = limits?.bankSlip;
  const limitAvailable = Number(relevantLimit?.available || 0);
  const limitUsedPct = limitAvailable > 0 ? Math.min(100, (selectedTotal / limitAvailable) * 100) : 0;
  const exceedsLimit = selectedTotal > limitAvailable && limitAvailable > 0;

  // Helper: get a friendly label for a given id (responsável)
  const getItemLabel = (id: string): string => {
    if (simulationType === 'payment') {
      const p = pendingPayments?.find(x => x.asaas_payment_id === id);
      return (p?.guardians as { name: string } | null)?.name || id.substring(0, 12);
    }
    const c = pendingCarnes?.find(x => x.asaas_installment_id === id);
    return (c?.guardians as { name: string } | null)?.name || id.substring(0, 12);
  };

  // Simulate anticipation mutation - tolerates per-item failures
  const simulateMutation = useMutation({
    mutationFn: async () => {
      if (effectiveIds.length === 0) throw new Error('Selecione ao menos um item');

      const settled = await Promise.all(effectiveIds.map(async (id) => {
        const payload = simulationType === 'payment' ? { payment: id } : { installment: id };
        try {
          const { data, error } = await supabase.functions.invoke('asaas-payment', {
            body: { action: 'simulateAnticipation', data: payload }
          });
          if (error) {
            let detail = error.message || 'Erro desconhecido';
            try {
              const ctx: any = (error as any).context;
              if (ctx && typeof ctx.json === 'function') {
                const body = await ctx.json();
                if (body?.error) detail = body.error;
              }
            } catch { /* ignore */ }
            throw new Error(detail);
          }
          if (data?.error) throw new Error(data.error);
          return { id, ok: true as const, data: data as SimulationResult };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { id, ok: false as const, reason: msg };
        }
      }));

      const okList = settled.filter(s => s.ok) as { id: string; ok: true; data: SimulationResult }[];
      const failList = settled.filter(s => !s.ok) as { id: string; ok: false; reason: string }[];

      if (okList.length === 0) {
        const first = failList[0]?.reason || 'Nenhum item elegível';
        throw new Error(first);
      }

      const aggregated: SimulationResult = {
        anticipatedValue: okList.reduce((s, r) => s + (r.data.anticipatedValue ?? (r.data as any).netValue ?? 0), 0),
        fee: okList.reduce((s, r) => s + (r.data.fee || 0), 0),
        totalValue: okList.reduce((s, r) => s + (r.data.totalValue || 0), 0),
        isDocumentationRequired: okList.some(r => r.data.isDocumentationRequired),
      };
      return {
        aggregated,
        eligible: okList.map(r => r.id),
        ineligible: failList.map(r => ({ id: r.id, reason: r.reason })),
      };
    },
    onSuccess: ({ aggregated, eligible, ineligible: ineli }) => {
      setSimulationResult(aggregated);
      setEligibleIds(eligible);
      setIneligible(ineli);
      const skipped = ineli.length;
      toast({
        title: skipped > 0 ? `Simulação parcial (${eligible.length}/${eligible.length + skipped})` : "Simulação realizada",
        description: skipped > 0
          ? `${skipped} ${skipped > 1 ? 'itens não elegíveis foram ignorados' : 'item não elegível foi ignorado'}. Líquido: R$ ${aggregated.anticipatedValue?.toFixed(2)}`
          : `Líquido: R$ ${aggregated.anticipatedValue?.toFixed(2) || '0.00'}`,
      });
    },
    onError: (error: Error) => {
      setSimulationResult(null); setEligibleIds([]); setIneligible([]);
      setEligibleIds([]);
      setIneligible([]);
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

  // Request anticipation mutation - sequentially per eligible id, with progress
  const requestMutation = useMutation({
    mutationFn: async () => {
      const ids = eligibleIds.length > 0 ? eligibleIds : effectiveIds;
      if (ids.length === 0) throw new Error('Nenhum item selecionado');
      setBulkProgress({ current: 0, total: ids.length, failures: [] });
      const failures: string[] = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const payload: Record<string, string> = simulationType === 'payment'
          ? { payment: id }
          : { installment: id };

        const contract = simulationType === 'payment' ? getPaymentContract(id) : selectedContract;
        const pdf = await resolveFreshContractPdfUrl(contract);
        if (pdf) payload.contractPdfUrl = pdf;

        try {
          const { data, error } = await supabase.functions.invoke('asaas-payment', {
            body: { action: 'requestAnticipation', data: payload }
          });
          if (error) {
            let detail = error.message || 'Erro desconhecido';
            try {
              const ctx: any = (error as any).context;
              if (ctx && typeof ctx.json === 'function') {
                const body = await ctx.json();
                if (body?.error) detail = body.error;
              }
            } catch { /* ignore */ }
            throw new Error(detail);
          }
          if (data?.error) throw new Error(data.error);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.push(`${getItemLabel(id)}: ${msg}`);
        }
        setBulkProgress({ current: i + 1, total: ids.length, failures: [...failures] });
      }

      return { total: ids.length, failures };
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
      setSimulationResult(null); setEligibleIds([]); setIneligible([]);
      setSimulationId('');
      setSelectedPaymentIds([]);
      setEligibleIds([]);
      setIneligible([]);
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              toast({ title: 'Sincronizando parcelas do Asaas...', description: 'Pode levar alguns segundos.' });
              const { data, error } = await supabase.functions.invoke('asaas-sync-carne-installments', { body: {} });
              if (error) {
                toast({ title: 'Erro ao sincronizar', description: error.message, variant: 'destructive' });
                return;
              }
              toast({
                title: 'Parcelas sincronizadas',
                description: `Carnês: ${data?.carnes_processed ?? 0} • Inseridas: ${data?.total_inserted ?? 0} • Atualizadas: ${data?.total_updated ?? 0}`,
              });
              refetch();
              queryClient.invalidateQueries({ queryKey: ['anticipation-limits'] });
              queryClient.invalidateQueries({ queryKey: ['pending-payments-for-anticipation'] });
              queryClient.invalidateQueries({ queryKey: ['pending-carnes-for-anticipation'] });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Sincronizar parcelas Asaas
          </Button>
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
              {/* Type selector, due date, month filters and search */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={simulationType} 
                    onValueChange={(v) => {
                      setSimulationType(v as 'payment' | 'installment');
                      setSimulationId('');
                      setSelectedPaymentIds([]);
                      setSimulationResult(null); setEligibleIds([]); setIneligible([]);
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
                  <Label>Vencimento até</Label>
                  <Select
                    value={dueDateFilter}
                    onValueChange={(v) => {
                      setDueDateFilter(v);
                      setSelectedPaymentIds([]);
                      setSimulationId('');
                      setSimulationResult(null);
                      setEligibleIds([]);
                      setIneligible([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os vencimentos futuros</SelectItem>
                      <SelectItem value="7">Próximos 7 dias</SelectItem>
                      <SelectItem value="15">Próximos 15 dias</SelectItem>
                      <SelectItem value="30">Próximos 30 dias</SelectItem>
                      <SelectItem value="60">Próximos 60 dias</SelectItem>
                      <SelectItem value="90">Próximos 90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mês de vencimento</Label>
                  <Select
                    value={monthFilter}
                    onValueChange={(v) => {
                      setMonthFilter(v);
                      setSelectedPaymentIds([]);
                      setSimulationId('');
                      setSimulationResult(null);
                      setEligibleIds([]);
                      setIneligible([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      <SelectItem value="0">Janeiro</SelectItem>
                      <SelectItem value="1">Fevereiro</SelectItem>
                      <SelectItem value="2">Março</SelectItem>
                      <SelectItem value="3">Abril</SelectItem>
                      <SelectItem value="4">Maio</SelectItem>
                      <SelectItem value="5">Junho</SelectItem>
                      <SelectItem value="6">Julho</SelectItem>
                      <SelectItem value="7">Agosto</SelectItem>
                      <SelectItem value="8">Setembro</SelectItem>
                      <SelectItem value="9">Outubro</SelectItem>
                      <SelectItem value="10">Novembro</SelectItem>
                      <SelectItem value="11">Dezembro</SelectItem>
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

              {/* Info chip explaining anticipable rules */}
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Mostrando apenas cobranças <strong>antecipáveis</strong>: status pendente, vencimento futuro
                  {onlyWithContract && <> e <strong>contrato assinado anexado</strong></>}.
                  O Asaas valida limites e elegibilidade final na simulação.
                </span>
              </div>

              {/* Contract filter */}
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="only-with-contract"
                    checked={onlyWithContract}
                    onCheckedChange={(checked) => {
                      setOnlyWithContract(!!checked);
                      setSelectedPaymentIds([]);
                      setSimulationId('');
                      setSimulationResult(null);
                      setEligibleIds([]);
                      setIneligible([]);
                    }}
                  />
                  <Label htmlFor="only-with-contract" className="cursor-pointer text-sm font-normal">
                    Mostrar apenas clientes com <strong>contrato assinado</strong> (recomendado)
                  </Label>
                </div>
                <Badge variant="outline" className="text-xs">
                  {simulationType === 'payment' ? filteredPayments.length : filteredCarnes.length} {(simulationType === 'payment' ? filteredPayments.length : filteredCarnes.length) === 1 ? 'item' : 'itens'}
                </Badge>
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
                                setSimulationResult(null); setEligibleIds([]); setIneligible([]);
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
                                setSimulationResult(null); setEligibleIds([]); setIneligible([]);
                              }}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    setSelectedPaymentIds(prev =>
                                      checked ? [...prev, pid] : prev.filter(id => id !== pid)
                                    );
                                    setSimulationResult(null); setEligibleIds([]); setIneligible([]);
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
                              setSimulationResult(null); setEligibleIds([]); setIneligible([]);
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

              {/* Selected vs limit bar */}
              {effectiveIds.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total selecionado
                    </span>
                    <span className={`font-semibold ${exceedsLimit ? 'text-destructive' : 'text-foreground'}`}>
                      {formatCurrency(selectedTotal)}
                      <span className="text-muted-foreground font-normal"> / {formatCurrency(limitAvailable)} disponível</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${exceedsLimit ? 'bg-destructive' : limitUsedPct > 80 ? 'bg-orange-500' : 'bg-primary'}`}
                      style={{ width: `${limitUsedPct}%` }}
                    />
                  </div>
                  {exceedsLimit && (
                    <p className="text-xs text-destructive">
                      Valor selecionado excede o limite disponível para antecipação.
                    </p>
                  )}
                </div>
              )}

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
                      ? selectedPaymentIds.every(id => !!getStoredContractPdfUrl(getPaymentContract(id)))
                      : !!getStoredContractPdfUrl(selectedContract);
                    const partialContract = simulationType === 'payment'
                      && !hasContract
                      && selectedPaymentIds.some(id => !!getStoredContractPdfUrl(getPaymentContract(id)));
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

                  {ineligible.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg border bg-destructive/10 border-destructive/30">
                      <p className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        {ineligible.length} {ineligible.length > 1 ? 'itens não elegíveis serão ignorados' : 'item não elegível será ignorado'}
                      </p>
                      <ul className="text-xs text-destructive/90 space-y-1 ml-6 list-disc">
                        {ineligible.slice(0, 5).map((item) => (
                          <li key={item.id}>
                            <span className="font-medium">{getItemLabel(item.id)}</span>: {item.reason}
                          </li>
                        ))}
                        {ineligible.length > 5 && (
                          <li className="italic">+{ineligible.length - 5} outros</li>
                        )}
                      </ul>
                    </div>
                  )}
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
                <span className="text-muted-foreground">Itens selecionados:</span>
                <span className="font-semibold">{effectiveIds.length}</span>
              </div>
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
              {bulkProgress && (
                <div className="pt-2 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processando...</span>
                    <span className="font-medium">{bulkProgress.current}/{bulkProgress.total}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={requestMutation.isPending}>
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
