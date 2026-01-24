import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  UserPlus,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MessageLog {
  id: string;
  guardian_id: string | null;
  lead_id: string | null;
  phone: string;
  template_category: string | null;
  message_preview: string | null;
  automation_key: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  guardian?: { name: string } | null;
  lead?: { name: string } | null;
}

const categoryLabels: Record<string, string> = {
  lead: 'Lead - Primeiro Contato',
  lead_followup: 'Lead - Acompanhamento',
  lead_scheduled: 'Lead - Agendamento',
  lead_reactivation: 'Lead - Reativação',
  enrollment: 'Matrícula',
  payment_reminder: 'Lembrete de Pagamento',
  payment_due_48h: 'Pagamento 48h',
  payment_overdue: 'Pagamento Atrasado',
  payment_confirmed: 'Pagamento Confirmado',
  birthday: 'Aniversário',
  lms_alert: 'Alerta LMS',
  general: 'Geral',
};

const automationLabels: Record<string, string> = {
  auto_payment_confirmed: 'Automático - Pagamento Confirmado',
  auto_payment_reminder_48h: 'Automático - Lembrete 48h',
  auto_payment_overdue: 'Automático - Atraso',
  auto_enrollment_welcome: 'Automático - Boas-vindas',
  auto_birthday_greeting: 'Automático - Aniversário',
  auto_lms_alert: 'Automático - Alerta LMS',
  manual: 'Manual',
  bulk: 'Envio em Massa',
};

export function MessageLogsViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, typeFilter]);

  const fetchLogs = async (reset = true) => {
    setIsLoading(true);
    const currentPage = reset ? 0 : page;
    
    let query = supabase
      .from('message_logs')
      .select(`
        *,
        guardian:guardians(name),
        lead:leads(name)
      `)
      .order('sent_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    
    if (typeFilter === 'guardian') {
      query = query.not('guardian_id', 'is', null);
    } else if (typeFilter === 'lead') {
      query = query.not('lead_id', 'is', null);
    } else if (typeFilter === 'auto') {
      query = query.not('automation_key', 'is', null);
    }
    
    const { data, error } = await query;
    
    if (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      if (reset) {
        setLogs(data || []);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...(data || [])]);
      }
      setHasMore((data?.length || 0) === PAGE_SIZE);
    }
    setIsLoading(false);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
    fetchLogs(false);
  };

  const handleExportCSV = () => {
    const headers = ['Data/Hora', 'Telefone', 'Destinatário', 'Tipo', 'Categoria', 'Automação', 'Status', 'Preview'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      log.phone,
      log.guardian?.name || log.lead?.name || '-',
      log.guardian_id ? 'Responsável' : log.lead_id ? 'Lead' : '-',
      log.template_category ? (categoryLabels[log.template_category] || log.template_category) : '-',
      log.automation_key ? (automationLabels[log.automation_key] || log.automation_key) : 'Manual',
      log.status,
      log.message_preview || '-',
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mensagens_whatsapp_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV foi baixado.',
    });
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.phone.includes(search) ||
      log.guardian?.name?.toLowerCase().includes(search) ||
      log.lead?.name?.toLowerCase().includes(search) ||
      log.message_preview?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRecipientInfo = (log: MessageLog) => {
    if (log.guardian?.name) {
      return (
        <div className="flex items-center gap-1">
          <User className="w-3 h-3 text-muted-foreground" />
          <span>{log.guardian.name}</span>
        </div>
      );
    }
    if (log.lead?.name) {
      return (
        <div className="flex items-center gap-1">
          <UserPlus className="w-3 h-3 text-muted-foreground" />
          <span>{log.lead.name}</span>
        </div>
      );
    }
    return <span className="text-muted-foreground">-</span>;
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Histórico de Mensagens
        </CardTitle>
        <CardDescription>
          Visualize todas as mensagens WhatsApp enviadas pelo sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone, nome ou mensagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="error">Com erro</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="guardian">Responsáveis</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="auto">Automáticos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchLogs(true)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>

        {/* Table */}
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data/Hora</TableHead>
                    <TableHead className="w-[120px]">Telefone</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="hidden md:table-cell">Preview</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.sent_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.phone}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getRecipientInfo(log)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {log.template_category && (
                            <Badge variant="outline" className="text-xs">
                              {categoryLabels[log.template_category] || log.template_category}
                            </Badge>
                          )}
                          {log.automation_key && (
                            <Badge variant="secondary" className="text-xs block w-fit">
                              {automationLabels[log.automation_key] || 'Automático'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">
                          {log.message_preview || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma mensagem encontrada</h3>
            <p className="text-muted-foreground">
              As mensagens enviadas serão exibidas aqui
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}