import { useState } from 'react';
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
  Percent,
  Calendar,
  CreditCard,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [simulationType, setSimulationType] = useState<'payment' | 'installment'>('payment');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  // Simulate anticipation mutation
  const simulateMutation = useMutation({
    mutationFn: async () => {
      const payload = simulationType === 'payment' 
        ? { payment: simulationId }
        : { installment: simulationId };
      
      const { data, error } = await supabase.functions.invoke('asaas-payment', {
        body: { action: 'simulateAnticipation', data: payload }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSimulationResult(data);
      toast({
        title: "Simulação realizada",
        description: `Valor líquido: R$ ${data.anticipatedValue?.toFixed(2) || '0.00'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na simulação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Request anticipation mutation
  const requestMutation = useMutation({
    mutationFn: async () => {
      const payload = simulationType === 'payment' 
        ? { payment: simulationId }
        : { installment: simulationId };
      
      const { data, error } = await supabase.functions.invoke('asaas-payment', {
        body: { action: 'requestAnticipation', data: payload }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Antecipação solicitada",
        description: "Sua solicitação foi enviada para análise.",
      });
      setShowConfirmDialog(false);
      setSimulationResult(null);
      setSimulationId('');
      queryClient.invalidateQueries({ queryKey: ['anticipations'] });
    },
    onError: (error: Error) => {
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
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Limits Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Limite Disponível</CardTitle>
          </CardHeader>
          <CardContent>
            {limitsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(limits?.creditLimit || 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Limite Utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            {limitsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(limits?.usedLimit || 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa Cartão / Boleto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <span className="text-primary">1,25%</span>
              <span className="text-muted-foreground mx-2">/</span>
              <span className="text-primary">5,79%</span>
            </p>
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
                Informe o ID da cobrança ou carnê para simular a antecipação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={simulationType} onValueChange={(v) => setSimulationType(v as 'payment' | 'installment')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Cobrança Avulsa
                        </div>
                      </SelectItem>
                      <SelectItem value="installment">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Carnê (Parcelamento)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ID da {simulationType === 'payment' ? 'Cobrança' : 'Parcela'}</Label>
                  <Input
                    placeholder={simulationType === 'payment' ? 'pay_xxxxxxxxxx' : 'ins_xxxxxxxxxx'}
                    value={simulationId}
                    onChange={(e) => setSimulationId(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => simulateMutation.mutate()}
                    disabled={!simulationId || simulateMutation.isPending}
                    className="w-full"
                  >
                    {simulateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4 mr-2" />
                    )}
                    Simular
                  </Button>
                </div>
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
                  
                  {simulationResult.isDocumentationRequired && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <strong>Documentação obrigatória:</strong> Esta antecipação requer envio de NF-e ou contrato de prestação de serviços.
                      </p>
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
