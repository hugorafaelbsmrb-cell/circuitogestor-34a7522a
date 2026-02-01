import { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Eye, Loader2, RefreshCw, Clock, AlertTriangle, Search, Filter,
  Send, Bell, BellOff, BookOpen, MessageSquare, CloudDownload, Database, Image, EyeOff
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReportImageManager from '@/components/reports/ReportImageManager';
import WeeklyReportView from '@/components/reports/WeeklyReportView';

const EXTERNAL_API_URL = 'https://uvnkqzwzsokyonxonzot.supabase.co/functions/v1/teacher-api/reports';
const EXTERNAL_API_KEY = 'teacher_api_circuitokids_2025';

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
  images?: string[];
  hidden_from_portal?: boolean;
  source?: 'local' | 'external';
  turma?: string;
  week_start?: string;
  week_end?: string;
  weekly_content?: {
    desempenho_geral?: string | null;
    pontos_positivos?: string | null;
    dificuldades?: string | null;
    recomendacoes?: string | null;
    observacoes?: string | null;
  };
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
  const [localReports, setLocalReports] = useState<ReportForApproval[]>([]);
  const [externalReports, setExternalReports] = useState<ReportForApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExternal, setIsLoadingExternal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<ReportForApproval | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState<string | null>(null);
  const [isHidingReport, setIsHidingReport] = useState<string | null>(null);
  const [autoNotifyEnabled, setAutoNotifyEnabled] = useState(false);
  const [isTogglingAuto, setIsTogglingAuto] = useState(false);

  // Combine local and external reports
  const reports = [...localReports, ...externalReports];

  useEffect(() => {
    fetchLocalReports();
    fetchExternalReports();
    checkAutoNotifyStatus();
  }, [statusFilter]);

  const checkAutoNotifyStatus = async () => {
    const enabled = isEnabled('auto_report_notification');
    setAutoNotifyEnabled(enabled);
  };

  useEffect(() => {
    checkAutoNotifyStatus();
  }, [isEnabled]);

  const fetchLocalReports = async () => {
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
          images,
          hidden_from_portal,
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
        source: 'local' as const,
        images: (item.images as string[] | null) || [],
        hidden_from_portal: item.hidden_from_portal ?? false,
        student: item.student as any,
        teacher: item.teacher as { id: string; name: string } | null,
      }));

      setLocalReports(mapped);
    } catch (error) {
      console.error('Error fetching local reports:', error);
      toast({
        title: 'Erro ao carregar relatórios locais',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExternalReports = async (showToast = false) => {
    setIsLoadingExternal(true);
    try {
      console.log('🔄 Buscando relatórios da API externa...');
      
      // First, get IDs of reports already imported locally
      const { data: localReportIds } = await supabase
        .from('student_reports')
        .select('id');
      
      const importedIds = new Set((localReportIds || []).map(r => r.id));
      
      const response = await fetch(EXTERNAL_API_URL, {
        method: 'GET',
        headers: {
          'x-api-key': EXTERNAL_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Resposta da API externa:', data);

      if (data.success) {
        const weeklyReports = (data.weekly_reports?.reports || [])
          // Filter out reports that are already imported locally
          .filter((apiReport: any) => !importedIds.has(apiReport.id))
          .map((apiReport: any) => {
            // Build content from the weekly report structure
            const contentParts = [];
            if (apiReport.content?.desempenho_geral) contentParts.push(`**Desempenho Geral:** ${apiReport.content.desempenho_geral}`);
            if (apiReport.content?.pontos_positivos) contentParts.push(`**Pontos Positivos:** ${apiReport.content.pontos_positivos}`);
            if (apiReport.content?.dificuldades) contentParts.push(`**Dificuldades:** ${apiReport.content.dificuldades}`);
            if (apiReport.content?.recomendacoes) contentParts.push(`**Recomendações:** ${apiReport.content.recomendacoes}`);
            if (apiReport.content?.observacoes) contentParts.push(`**Observações:** ${apiReport.content.observacoes}`);

            return {
              id: apiReport.id,
              title: `Relatório Semanal - ${apiReport.turma || 'Turma'}`,
              content: contentParts.join('\n\n') || 'Sem conteúdo disponível',
              report_date: apiReport.week?.start || apiReport.created_at,
              report_type: 'weekly',
              status: apiReport.status,
              // Use approval_status from API if available, otherwise default to pending
              approval_status: apiReport.approval_status || 'pending',
              rejection_reason: apiReport.rejection_reason || null,
              created_at: apiReport.created_at,
              notification_sent_at: null,
              read_at: null,
              read_by_guardian: null,
              source: 'external' as const,
              turma: apiReport.turma,
              week_start: apiReport.week?.start,
              week_end: apiReport.week?.end,
              weekly_content: apiReport.content,
              student: {
                id: '',
                name: apiReport.turma || 'Turma não especificada',
                guardian: null,
              },
              teacher: apiReport.teacher ? {
                id: apiReport.teacher.id,
                name: apiReport.teacher.name,
              } : null,
            };
          });

        const pedagogicalReports = (data.pedagogical_reports?.reports || [])
          // Filter out reports that are already imported locally
          .filter((apiReport: any) => !importedIds.has(apiReport.id))
          .map((apiReport: any) => ({
            id: apiReport.id,
            title: apiReport.title,
            content: apiReport.content,
            report_date: apiReport.report_date,
            report_type: apiReport.report_type,
            status: apiReport.status,
            // Use approval_status from API if available, otherwise default to pending
            approval_status: apiReport.approval_status || 'pending',
            rejection_reason: apiReport.rejection_reason || null,
            created_at: apiReport.created_at,
            notification_sent_at: null,
            read_at: null,
            read_by_guardian: null,
            source: 'external' as const,
            student: apiReport.student_name ? {
              id: apiReport.student_id || '',
              name: apiReport.student_name,
              guardian: apiReport.guardian_name ? {
                id: '',
                name: apiReport.guardian_name,
                phone: apiReport.guardian_phone || '',
              } : null,
            } : null,
            teacher: apiReport.teacher_name ? {
              id: apiReport.teacher_id || '',
              name: apiReport.teacher_name,
            } : null,
          }));

        // Only show external reports that haven't been imported yet
        let allExternalReports = [...weeklyReports, ...pedagogicalReports];
        
        // Filter by status if not 'all'
        if (statusFilter !== 'all') {
          allExternalReports = allExternalReports.filter(r => r.approval_status === statusFilter);
        }

        setExternalReports(allExternalReports);

        if (showToast) {
          const importedCount = importedIds.size;
          toast({
            title: 'Relatórios externos atualizados',
            description: `${allExternalReports.length} pendente(s), ${importedCount} já importado(s)`,
          });
        }
      } else {
        throw new Error(data.error || 'Erro ao buscar relatórios');
      }
    } catch (error) {
      console.error('Error fetching external reports:', error);
      if (showToast) {
        toast({
          title: 'Erro ao carregar relatórios externos',
          description: 'Verifique a conexão com a API externa',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoadingExternal(false);
    }
  };

  const fetchAllReports = () => {
    fetchLocalReports();
    fetchExternalReports(true);
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
        fetchLocalReports();
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
      
      let reportId = report.id;
      
      // If external report, call external API to approve first
      if (report.source === 'external') {
        console.log('📤 Chamando API externa para aprovar relatório...');
        
        const approveResponse = await fetch(`${EXTERNAL_API_URL}/approve`, {
          method: 'POST',
          headers: {
            'x-api-key': EXTERNAL_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            report_id: report.id,
            approved_by: user?.email || user?.id,
          }),
        });

        if (!approveResponse.ok) {
          const errorData = await approveResponse.json();
          throw new Error(errorData.error || `Erro na API externa: ${approveResponse.status}`);
        }

        const approveData = await approveResponse.json();
        console.log('✅ Aprovação na API externa:', approveData);
        
        // Now import to local database
        console.log('📥 Importando relatório externo para o banco local...');
        
        // Check if report already exists locally
        const { data: existingReport } = await supabase
          .from('student_reports')
          .select('id')
          .eq('id', report.id)
          .maybeSingle();
        
        if (!existingReport) {
          // Import the external report to local database
          // For student_id: try to find local student by name
          let studentId: string | null = null;
          if (report.student?.name) {
            const { data: localStudent } = await supabase
              .from('students')
              .select('id')
              .ilike('name', report.student.name)
              .maybeSingle();
            
            if (localStudent) {
              studentId = localStudent.id;
              console.log('✅ Aluno local encontrado:', report.student.name, '->', studentId);
            } else {
              console.log('⚠️ Aluno não encontrado localmente:', report.student.name);
            }
          }
          
          // For teacher_id: try to find local teacher by name, otherwise null
          let teacherId: string | null = null;
          if (report.teacher?.name) {
            const { data: localTeacher } = await supabase
              .from('teachers')
              .select('id')
              .ilike('name', report.teacher.name)
              .maybeSingle();
            
            if (localTeacher) {
              teacherId = localTeacher.id;
              console.log('✅ Professor local encontrado:', report.teacher.name, '->', teacherId);
            } else {
              console.log('⚠️ Professor não encontrado localmente:', report.teacher.name);
            }
          }
          
          const { data: insertedReport, error: insertError } = await supabase
            .from('student_reports')
            .insert({
              id: report.id, // Keep the same ID for reference
              title: report.title,
              content: report.content,
              report_date: report.report_date,
              report_type: report.report_type,
              status: report.status,
              approval_status: 'approved',
              approved_at: new Date().toISOString(),
              approved_by: user?.id,
              student_id: studentId,
              teacher_id: teacherId,
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('Error importing external report:', insertError);
            throw new Error(`Não foi possível importar o relatório externo: ${insertError.message}`);
          }
          
          reportId = insertedReport.id;
          console.log('✅ Relatório externo importado com sucesso:', reportId);
        } else {
          // Report already exists, just update approval status
          const { error: updateError } = await supabase
            .from('student_reports')
            .update({
              approval_status: 'approved',
              approved_at: new Date().toISOString(),
              approved_by: user?.id,
              rejection_reason: null,
            })
            .eq('id', report.id);
          
          if (updateError) throw updateError;
        }
      } else {
        // Local report - just update
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
      }

      toast({
        title: 'Relatório aprovado',
        description: 'O relatório foi liberado para o portal de acompanhamento familiar',
      });

      // Send automatic notification if enabled
      if (autoNotifyEnabled && report.student?.guardian?.phone) {
        try {
          await supabase.functions.invoke('send-report-notification', {
            body: { reportId },
          });
          toast({
            title: 'Notificação enviada',
            description: `${report.student.guardian.name} foi notificado automaticamente`,
          });
        } catch (notifyError) {
          console.error('Auto notification failed:', notifyError);
        }
      }

      fetchLocalReports();
      fetchExternalReports(); // Refresh external reports too
      setIsViewModalOpen(false);
    } catch (error: any) {
      console.error('Error approving report:', error);
      toast({
        title: 'Erro ao aprovar',
        description: error.message || 'Não foi possível aprovar o relatório',
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
      
      // If external report, call external API to reject
      if (selectedReport.source === 'external') {
        console.log('📤 Chamando API externa para rejeitar relatório...');
        
        const rejectResponse = await fetch(`${EXTERNAL_API_URL}/reject`, {
          method: 'POST',
          headers: {
            'x-api-key': EXTERNAL_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            report_id: selectedReport.id,
            rejected_by: user?.email || user?.id,
            feedback: rejectionReason.trim(),
          }),
        });

        if (!rejectResponse.ok) {
          const errorData = await rejectResponse.json();
          throw new Error(errorData.error || `Erro na API externa: ${rejectResponse.status}`);
        }

        const rejectData = await rejectResponse.json();
        console.log('✅ Rejeição na API externa:', rejectData);

        toast({
          title: 'Relatório rejeitado',
          description: 'O professor será notificado para revisão',
        });

        setRejectionReason('');
        setIsRejectModalOpen(false);
        setIsViewModalOpen(false);
        fetchExternalReports(); // Refresh external reports
      } else {
        // Local report - update in database
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
        fetchLocalReports();
      }
    } catch (error: any) {
      console.error('Error rejecting report:', error);
      toast({
        title: 'Erro ao rejeitar',
        description: error.message || 'Não foi possível rejeitar o relatório',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const hideReportFromPortal = async (report: ReportForApproval) => {
    if (report.source === 'external') {
      toast({
        title: 'Operação não permitida',
        description: 'Importe o relatório externo antes de ocultar',
        variant: 'destructive',
      });
      return;
    }

    setIsHidingReport(report.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ hidden_from_portal: true })
        .eq('id', report.id);

      if (error) throw error;

      toast({
        title: 'Relatório ocultado',
        description: 'O relatório não aparecerá mais no portal dos pais',
      });

      fetchLocalReports();
    } catch (error) {
      console.error('Error hiding report:', error);
      toast({
        title: 'Erro ao ocultar',
        description: 'Não foi possível ocultar o relatório',
        variant: 'destructive',
      });
    } finally {
      setIsHidingReport(null);
    }
  };

  const showReportInPortal = async (report: ReportForApproval) => {
    setIsHidingReport(report.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ hidden_from_portal: false })
        .eq('id', report.id);

      if (error) throw error;

      toast({
        title: 'Relatório visível',
        description: 'O relatório agora aparecerá no portal dos pais',
      });

      fetchLocalReports();
    } catch (error) {
      console.error('Error showing report:', error);
      toast({
        title: 'Erro ao exibir',
        description: 'Não foi possível exibir o relatório',
        variant: 'destructive',
      });
    } finally {
      setIsHidingReport(null);
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

  const getSourceBadge = (source?: 'local' | 'external') => {
    if (source === 'external') {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <CloudDownload className="w-3 h-3 mr-1" />
          API
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        <Database className="w-3 h-3 mr-1" />
        Local
      </Badge>
    );
  };

  const filteredReports = reports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      report.student?.name?.toLowerCase().includes(searchLower) ||
      report.title?.toLowerCase().includes(searchLower) ||
      report.teacher?.name?.toLowerCase().includes(searchLower) ||
      report.turma?.toLowerCase().includes(searchLower)
    );
    
    const matchesSource = sourceFilter === 'all' || report.source === sourceFilter;
    
    return matchesSearch && matchesSource;
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
          <SelectTrigger className="w-full sm:w-40">
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
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Database className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="external">API Externa</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchAllReports} disabled={isLoading || isLoadingExternal}>
          {isLoadingExternal ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {/* External API loading indicator */}
      {isLoadingExternal && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center gap-3 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-blue-700 text-sm">Carregando relatórios da API externa...</span>
          </CardContent>
        </Card>
      )}

      {/* External reports count */}
      {externalReports.length > 0 && !isLoadingExternal && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 py-3">
            <CloudDownload className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700 text-sm">
              {externalReports.length} relatório(s) carregado(s) da API externa
            </span>
          </CardContent>
        </Card>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Aprovação de Relatórios</CardTitle>
          <CardDescription>
            Revise e aprove os relatórios antes de liberá-los para o portal de acompanhamento familiar
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
                  <TableHead>Aluno/Turma</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Leitura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={`${report.source}-${report.id}`}>
                    <TableCell className="font-medium">
                      {report.turma || report.student?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{report.title}</span>
                        {report.week_start && report.week_end && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(report.week_start), 'dd/MM', { locale: ptBR })} - {format(parseISO(report.week_end), 'dd/MM', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{report.teacher?.name || '-'}</TableCell>
                    <TableCell>
                      {format(parseISO(report.report_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getApprovalBadge(report.approval_status)}
                        {getNotificationBadge(report)}
                        {report.hidden_from_portal && (
                          <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Oculto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getSourceBadge(report.source)}
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

                        {report.approval_status === 'approved' && report.source === 'local' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={report.hidden_from_portal 
                                    ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                                    : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  }
                                  onClick={() => report.hidden_from_portal 
                                    ? showReportInPortal(report) 
                                    : hideReportFromPortal(report)
                                  }
                                  disabled={isHidingReport === report.id}
                                >
                                  {isHidingReport === report.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : report.hidden_from_portal ? (
                                    <Eye className="w-4 h-4" />
                                  ) : (
                                    <EyeOff className="w-4 h-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {report.hidden_from_portal ? 'Exibir no portal' : 'Ocultar do portal'}
                              </TooltipContent>
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

              {/* Weekly report structured content */}
              {(() => {
                // Try to parse structured content from weekly_content or from content field
                let parsedContent: Record<string, string | null | undefined> | null = selectedReport.weekly_content as Record<string, string | null | undefined> | null;
                
                if (!parsedContent && selectedReport.content && (selectedReport.report_type === 'weekly' || selectedReport.report_type === 'semanal')) {
                  // First try JSON parsing
                  try {
                    parsedContent = typeof selectedReport.content === 'string' 
                      ? JSON.parse(selectedReport.content) 
                      : selectedReport.content;
                  } catch {
                    // JSON parse failed, try markdown format
                    parsedContent = null;
                  }
                  
                  // If JSON failed, try markdown format: **Chave:** Valor
                  if (!parsedContent && typeof selectedReport.content === 'string' && selectedReport.content.includes('**')) {
                    const parsed: Record<string, string> = {};
                    
                    // Extract sections using regex
                    const desempenhoMatch = selectedReport.content.match(/\*\*Desempenho Geral:\*\*\s*([\s\S]*?)(?=\*\*Pontos Positivos:|$)/i);
                    const pontosMatch = selectedReport.content.match(/\*\*Pontos Positivos:\*\*\s*([\s\S]*?)(?=\*\*Dificuldades:|$)/i);
                    const dificuldadesMatch = selectedReport.content.match(/\*\*Dificuldades:\*\*\s*([\s\S]*?)(?=\*\*Recomendações:|$)/i);
                    const recomendacoesMatch = selectedReport.content.match(/\*\*Recomendações:\*\*\s*([\s\S]*?)(?=\*\*Observações:|--- SUGESTÕES|$)/i);
                    const observacoesMatch = selectedReport.content.match(/\*\*Observações:\*\*\s*([\s\S]*?)(?=--- SUGESTÕES|$)/i);
                    
                    if (desempenhoMatch) parsed.desempenho_geral = desempenhoMatch[1].trim();
                    if (pontosMatch) parsed.pontos_positivos = pontosMatch[1].trim();
                    if (dificuldadesMatch) parsed.dificuldades = dificuldadesMatch[1].trim();
                    if (recomendacoesMatch) parsed.recomendacoes = recomendacoesMatch[1].trim();
                    if (observacoesMatch) parsed.observacoes = observacoesMatch[1].trim();
                    
                    if (Object.keys(parsed).length > 0) {
                      parsedContent = parsed;
                    }
                  }
                }

                const hasStructuredContent = parsedContent && (
                  parsedContent.desempenho_geral || 
                  parsedContent.pontos_positivos || 
                  parsedContent.dificuldades || 
                  parsedContent.recomendacoes || 
                  parsedContent.observacoes || 
                  parsedContent.performance || 
                  parsedContent.positive_points || 
                  parsedContent.difficulties || 
                  parsedContent.recommendations || 
                  parsedContent.observations
                );

                if (hasStructuredContent && parsedContent) {
                  return (
                    <WeeklyReportView
                      content={parsedContent}
                      studentName={selectedReport.student?.name || selectedReport.turma || '-'}
                      teacherName={selectedReport.teacher?.name}
                      reportDate={
                        selectedReport.week_start && selectedReport.week_end
                          ? `${format(parseISO(selectedReport.week_start), 'dd/MM', { locale: ptBR })} - ${format(parseISO(selectedReport.week_end), 'dd/MM/yyyy', { locale: ptBR })}`
                          : format(parseISO(selectedReport.report_date), 'dd/MM/yyyy', { locale: ptBR })
                      }
                      title={selectedReport.title}
                    />
                  );
                }

                return (
                  <div>
                    <Label className="text-muted-foreground">Conteúdo</Label>
                    <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                      {selectedReport.content}
                    </div>
                  </div>
                );
              })()}

              {/* Image Manager - Only show for local reports that are approved or pending */}
              {selectedReport.source === 'local' && (
                <>
                  <Separator />
                  <ReportImageManager
                    reportId={selectedReport.id}
                    images={selectedReport.images || []}
                    onImagesUpdate={(newImages) => {
                      setSelectedReport({ ...selectedReport, images: newImages });
                      fetchLocalReports();
                    }}
                    isReadOnly={selectedReport.approval_status === 'rejected'}
                  />
                </>
              )}
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
