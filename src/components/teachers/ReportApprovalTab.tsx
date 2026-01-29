import { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Eye, Loader2, RefreshCw, Clock, AlertTriangle, Search, Filter,
  Send, Bell, BellOff, BookOpen, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportForApproval {
  id: string;
  title: string;
  content: string;
  report_date: string;
  report_type: string | null;
  status: string | null;
  approval_status: string;
  rejection_reason: string | null;
  created_at: string;
  notification_sent_at: string | null;
  read_at: string | null;
  read_by_guardian: boolean | null;
  student?: {
    id: string;
    name: string;
    guardian?: {
      id: string;
      name: string;
      phone: string;
    } | null;
  } | null;
  teacher?: {
    id: string;
    name: string;
  } | null;
}

export default function ReportApprovalTab() {
  const { toast } = useToast();
  const { isEnabled, refetch: refetchAutomation } = useAutomationSettings();
  const [reports, setReports] = useState<ReportForApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<ReportForApproval | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState<string | null>(null);
  const [autoNotifyEnabled, setAutoNotifyEnabled] = useState(false);
  const [isTogglingAuto, setIsTogglingAuto] = useState(false);

  useEffect(() => {
    fetchReports();
    checkAutoNotifyStatus();
  }, [statusFilter]);

  const checkAutoNotifyStatus = async () => {
    const enabled = isEnabled('auto_report_notification');
    setAutoNotifyEnabled(enabled);
  };

  useEffect(() => {
    checkAutoNotifyStatus();
  }, [isEnabled]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('student_reports')
        .select(`
          id,
          title,
          content,
          report_date,
          report_type,
          status,
          approval_status,
          rejection_reason,
          created_at,
          notification_sent_at,
          read_at,
          read_by_guardian,
          student:students(id, name, guardian:guardians(id, name, phone)),
          teacher:teachers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('approval_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map(item => ({
        ...item,
        student: item.student as any,
        teacher: item.teacher as { id: string; name: string } | null,
      }));

      setReports(mapped);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: 'Erro ao carregar relatórios',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoNotification = async () => {
    setIsTogglingAuto(true);
    try {
      const { error } = await supabase
        .from('automation_settings')
        .update({ enabled: !autoNotifyEnabled, updated_at: new Date().toISOString() })
        .eq('key', 'auto_report_notification');

      if (error) throw error;

      setAutoNotifyEnabled(!autoNotifyEnabled);
      await refetchAutomation();

      toast({
        title: autoNotifyEnabled ? 'Notificação automática desativada' : 'Notificação automática ativada',
        description: autoNotifyEnabled 
          ? 'Os pais não serão notificados automaticamente'
          : 'Os pais serão notificados automaticamente quando um relatório for aprovado',
      });
    } catch (error) {
      console.error('Error toggling auto notification:', error);
      toast({
        title: 'Erro ao alterar configuração',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingAuto(false);
    }
  };

  const sendNotification = async (report: ReportForApproval) => {
    if (!report.student?.guardian?.phone) {
      toast({
        title: 'Telefone não encontrado',
        description: 'O responsável não possui telefone cadastrado',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingNotification(report.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-report-notification', {
        body: { reportId: report.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Notificação enviada',
          description: `${report.student.guardian.name} foi notificado via WhatsApp`,
        });
        fetchReports();
      } else {
        throw new Error(data?.error || 'Falha no envio');
      }
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Erro ao enviar notificação',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsSendingNotification(null);
    }
  };

  const handleApprove = async (report: ReportForApproval) => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('student_reports')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          rejection_reason: null,
        })
        .eq('id', report.id);

      if (error) throw error;

      toast({
        title: 'Relatório aprovado',
        description: 'O relatório foi liberado para o portal dos pais',
      });

      // Send automatic notification if enabled
      if (autoNotifyEnabled && report.student?.guardian?.phone) {
        try {
          await supabase.functions.invoke('send-report-notification', {
            body: { reportId: report.id },
          });
          toast({
            title: 'Notificação enviada',
            description: `${report.student.guardian.name} foi notificado automaticamente`,
          });
        } catch (notifyError) {
          console.error('Auto notification failed:', notifyError);
        }
      }

      fetchReports();
      setIsViewModalOpen(false);
    } catch (error) {
      console.error('Error approving report:', error);
      toast({
        title: 'Erro ao aprovar',
        description: 'Não foi possível aprovar o relatório',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReport || !rejectionReason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da rejeição',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('student_reports')
        .update({
          approval_status: 'rejected',
          approved_at: null,
          approved_by: user?.id,
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast({
        title: 'Relatório rejeitado',
        description: 'O professor será notificado para revisão',
      });

      setRejectionReason('');
      setIsRejectModalOpen(false);
      setIsViewModalOpen(false);
      fetchReports();
    } catch (error) {
      console.error('Error rejecting report:', error);
      toast({
        title: 'Erro ao rejeitar',
        description: 'Não foi possível rejeitar o relatório',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openRejectModal = (report: ReportForApproval) => {
    setSelectedReport(report);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Rejeitado</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pendente</Badge>;
    }
  };

  const getReadBadge = (report: ReportForApproval) => {
    if (report.approval_status !== 'approved') return null;
    
    if (report.read_by_guardian || report.read_at) {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
          <BookOpen className="w-3 h-3" />
          Lido
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1">
        <BookOpen className="w-3 h-3" />
        Não lido
      </Badge>
    );
  };

  const getNotificationBadge = (report: ReportForApproval) => {
    if (report.approval_status !== 'approved') return null;
    
    if (report.notification_sent_at) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1">
                <MessageSquare className="w-3 h-3" />
                Notificado
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Enviado em {format(parseISO(report.notification_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
  };

  const filteredReports = reports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      report.student?.name?.toLowerCase().includes(searchLower) ||
      report.title?.toLowerCase().includes(searchLower) ||
      report.teacher?.name?.toLowerCase().includes(searchLower)
    );
  });

  const pendingCount = reports.filter(r => r.approval_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Auto Notification Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {autoNotifyEnabled ? (
              <Bell className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Notificação automática via WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                {autoNotifyEnabled 
                  ? 'Os pais serão notificados automaticamente quando um relatório for aprovado'
                  : 'As notificações precisam ser enviadas manualmente'}
              </p>
            </div>
          </div>
          <Switch
            checked={autoNotifyEnabled}
            onCheckedChange={toggleAutoNotification}
            disabled={isTogglingAuto}
          />
        </CardContent>
      </Card>

      {/* Stats Card */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 font-medium">
              {pendingCount} relatório(s) aguardando aprovação
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setStatusFilter('pending')}
            >
              Ver pendentes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por aluno, professor ou título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchReports}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Aprovação de Relatórios</CardTitle>
          <CardDescription>
            Revise e aprove os relatórios antes de liberá-los para o portal dos pais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum relatório encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leitura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.student?.name || '-'}
                    </TableCell>
                    <TableCell>{report.title}</TableCell>
                    <TableCell>{report.teacher?.name || '-'}</TableCell>
                    <TableCell>
                      {format(parseISO(report.report_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getApprovalBadge(report.approval_status)}
                        {getNotificationBadge(report)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getReadBadge(report)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setIsViewModalOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Visualizar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {report.approval_status === 'approved' && !report.notification_sent_at && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => sendNotification(report)}
                                  disabled={isSendingNotification === report.id}
                                >
                                  {isSendingNotification === report.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Enviar notificação WhatsApp</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {report.approval_status === 'pending' && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(report)}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Aprovar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => openRejectModal(report)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rejeitar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
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

      {/* View Report Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Aluno</Label>
                  <p className="font-medium">{selectedReport.student?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Professor</Label>
                  <p className="font-medium">{selectedReport.teacher?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data do Relatório</Label>
                  <p className="font-medium">
                    {format(parseISO(selectedReport.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status de Aprovação</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {getApprovalBadge(selectedReport.approval_status)}
                    {getReadBadge(selectedReport)}
                    {getNotificationBadge(selectedReport)}
                  </div>
                </div>
              </div>

              {selectedReport.read_at && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-blue-700 font-medium flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Relatório visualizado pelo responsável
                  </Label>
                  <p className="text-blue-600 text-sm mt-1">
                    Em {format(parseISO(selectedReport.read_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}

              {selectedReport.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <Label className="text-red-700 font-medium">Motivo da Rejeição</Label>
                  <p className="text-red-600 text-sm mt-1">{selectedReport.rejection_reason}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Conteúdo</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {selectedReport.content}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedReport?.approval_status === 'approved' && !selectedReport.notification_sent_at && (
              <Button
                variant="outline"
                onClick={() => sendNotification(selectedReport)}
                disabled={isSendingNotification === selectedReport.id}
                className="text-primary border-primary/20 hover:bg-primary/10"
              >
                {isSendingNotification === selectedReport.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Notificação
              </Button>
            )}
            {selectedReport?.approval_status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => openRejectModal(selectedReport)}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={() => handleApprove(selectedReport)}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Aprovar
                </Button>
              </>
            )}
            {selectedReport?.approval_status === 'rejected' && (
              <Button
                onClick={() => handleApprove(selectedReport)}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Aprovar Agora
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da rejeição para que o professor possa revisar o relatório.
            </p>
            <div>
              <Label>Motivo da Rejeição *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Descreva o que precisa ser corrigido ou melhorado..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
