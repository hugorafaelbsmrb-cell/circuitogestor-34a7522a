import { useState, useEffect } from 'react';
import { FileText, Printer, Send, Eye, Loader2, Search, Calendar, User, RefreshCw, ClipboardList, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSystemBranding } from '@/hooks/useSystemBranding';

const API_URL = 'https://uvnkqzwzsokyonxonzot.supabase.co/functions/v1/teacher-api/reports';
const API_KEY = 'teacher_api_circuitokids_2025';

interface ApiWeeklyReport {
  id: string;
  type: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  turma: string;
  week: {
    start: string;
    end: string;
  };
  content: {
    desempenho_geral: string | null;
    pontos_positivos: string | null;
    dificuldades: string | null;
    recomendacoes: string | null;
    observacoes: string | null;
  };
  student_observations: unknown[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface ApiPedagogicalReport {
  id: string;
  student_id: string | null;
  teacher_id: string | null;
  title: string;
  content: string;
  report_date: string;
  report_type: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
  student_name?: string;
  teacher_name?: string;
  guardian_name?: string;
  guardian_phone?: string;
}

interface WeeklyContent {
  desempenho_geral?: string | null;
  pontos_positivos?: string | null;
  dificuldades?: string | null;
  recomendacoes?: string | null;
  observacoes?: string | null;
}

interface StudentReport {
  id: string;
  student_id: string | null;
  teacher_id: string | null;
  title: string;
  content: string;
  report_date: string;
  report_type: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
  // For weekly reports
  week_start?: string;
  week_end?: string;
  turma?: string;
  weekly_content?: WeeklyContent;
  student?: {
    id: string;
    name: string;
    guardian?: {
      id: string;
      name: string;
      phone: string;
    };
  };
  teacher?: {
    id: string;
    name: string;
  };
}

interface Teacher {
  id: string;
  name: string;
}

export default function StudentReportsTab() {
  const { toast } = useToast();
  const { branding } = useSystemBranding();
  const [weeklyReports, setWeeklyReports] = useState<StudentReport[]>([]);
  const [pedagogicalReports, setPedagogicalReports] = useState<StudentReport[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<StudentReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState('pedagogical');

  useEffect(() => {
    fetchReportsFromAPI();
    fetchTeachers();
  }, []);

  const mapWeeklyReportToStudentReport = (apiReport: ApiWeeklyReport): StudentReport => {
    // Build content from the weekly report structure
    const contentParts = [];
    if (apiReport.content?.desempenho_geral) contentParts.push(`**Desempenho Geral:** ${apiReport.content.desempenho_geral}`);
    if (apiReport.content?.pontos_positivos) contentParts.push(`**Pontos Positivos:** ${apiReport.content.pontos_positivos}`);
    if (apiReport.content?.dificuldades) contentParts.push(`**Dificuldades:** ${apiReport.content.dificuldades}`);
    if (apiReport.content?.recomendacoes) contentParts.push(`**Recomendações:** ${apiReport.content.recomendacoes}`);
    if (apiReport.content?.observacoes) contentParts.push(`**Observações:** ${apiReport.content.observacoes}`);

    return {
      id: apiReport.id,
      student_id: null,
      teacher_id: apiReport.teacher?.id || null,
      title: `Relatório Semanal`,
      content: contentParts.join('\n\n') || 'Sem conteúdo disponível',
      report_date: apiReport.week?.start || apiReport.created_at,
      report_type: 'weekly',
      status: apiReport.status,
      sent_at: null,
      created_at: apiReport.created_at,
      // Weekly-specific fields
      week_start: apiReport.week?.start,
      week_end: apiReport.week?.end,
      turma: apiReport.turma,
      weekly_content: apiReport.content,
      student: {
        id: '',
        name: apiReport.turma || 'Turma não especificada',
        guardian: undefined,
      },
      teacher: apiReport.teacher ? {
        id: apiReport.teacher.id,
        name: apiReport.teacher.name,
      } : undefined,
    };
  };

  const mapPedagogicalReportToStudentReport = (apiReport: ApiPedagogicalReport): StudentReport => {
    return {
      id: apiReport.id,
      student_id: apiReport.student_id,
      teacher_id: apiReport.teacher_id,
      title: apiReport.title,
      content: apiReport.content,
      report_date: apiReport.report_date,
      report_type: apiReport.report_type,
      status: apiReport.status,
      sent_at: apiReport.sent_at,
      created_at: apiReport.created_at,
      student: apiReport.student_name ? {
        id: apiReport.student_id || '',
        name: apiReport.student_name,
        guardian: apiReport.guardian_name ? {
          id: '',
          name: apiReport.guardian_name,
          phone: apiReport.guardian_phone || '',
        } : undefined,
      } : undefined,
      teacher: apiReport.teacher_name ? {
        id: apiReport.teacher_id || '',
        name: apiReport.teacher_name,
      } : undefined,
    };
  };

  const fetchReportsFromAPI = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (teacherFilter !== 'all') {
        params.append('teacher_id', teacherFilter);
      }
      if (statusFilter !== 'all') {
        const statusMap: Record<string, string> = {
          'pending': 'rascunho',
          'sent': 'finalizado',
        };
        params.append('status', statusMap[statusFilter] || statusFilter);
      }

      const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const weeklyMapped = (data.weekly_reports?.reports || []).map(mapWeeklyReportToStudentReport);
        const pedagogicalMapped = (data.pedagogical_reports?.reports || []).map(mapPedagogicalReportToStudentReport);
        
        setWeeklyReports(weeklyMapped);
        setPedagogicalReports(pedagogicalMapped);
      } else {
        throw new Error(data.error || 'Erro ao buscar relatórios');
      }
    } catch (error) {
      console.error('Error fetching reports from API:', error);
      toast({
        title: 'Erro ao carregar relatórios',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const getFilteredReports = (reports: StudentReport[]) => {
    return reports.filter(report => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        report.student?.name?.toLowerCase().includes(searchLower) ||
        report.title?.toLowerCase().includes(searchLower) ||
        report.teacher?.name?.toLowerCase().includes(searchLower);
      
      return matchesSearch;
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'sent':
      case 'finalizado':
        return <Badge className="bg-primary text-primary-foreground">Enviado</Badge>;
      case 'pending':
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'viewed':
        return <Badge className="bg-accent text-accent-foreground">Visualizado</Badge>;
      default:
        return <Badge variant="outline">{status || 'Novo'}</Badge>;
    }
  };

  const handleViewReport = (report: StudentReport) => {
    setSelectedReport(report);
    setIsViewModalOpen(true);
  };

  const handleRefresh = () => {
    fetchReportsFromAPI();
  };

  const handlePrint = () => {
    if (!selectedReport) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoUrl = branding?.logo;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório - ${selectedReport.student?.name || 'Aluno'}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .logo {
            max-height: 60px;
            margin-bottom: 10px;
          }
          .school-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .report-title {
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0 10px;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .meta-item {
            text-align: center;
          }
          .meta-label {
            font-size: 12px;
            color: #666;
            display: block;
          }
          .meta-value {
            font-size: 14px;
            font-weight: bold;
          }
          .content {
            line-height: 1.8;
            white-space: pre-wrap;
            text-align: justify;
            margin-top: 30px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : ''}
          <div class="school-name">${branding?.name || 'Circuito Kids'}</div>
          <div>Relatório Pedagógico</div>
        </div>
        
        <h1 class="report-title">${selectedReport.title}</h1>
        
        <div class="meta-info">
          <div class="meta-item">
            <span class="meta-label">Aluno</span>
            <span class="meta-value">${selectedReport.student?.name || '-'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Professor</span>
            <span class="meta-value">${selectedReport.teacher?.name || '-'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Data do Relatório</span>
            <span class="meta-value">${selectedReport.report_date ? format(parseISO(selectedReport.report_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
          </div>
        </div>
        
        <div class="content">${selectedReport.content}</div>
        
        <div class="footer">
          Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSendWhatsApp = async () => {
    if (!selectedReport || !selectedReport.student?.guardian?.phone) {
      toast({
        title: 'Erro',
        description: 'Responsável não encontrado ou sem telefone cadastrado',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['W_API_TOKEN', 'W_API_SESSION']);

      const wapiToken = settings?.find(s => s.key === 'W_API_TOKEN')?.value;
      const wapiSession = settings?.find(s => s.key === 'W_API_SESSION')?.value;

      if (!wapiToken || !wapiSession) {
        throw new Error('Configuração do WhatsApp não encontrada');
      }

      const phone = selectedReport.student.guardian.phone.replace(/\D/g, '');
      const guardianName = selectedReport.student.guardian.name.split(' ')[0];
      
      const message = `📋 *RELATÓRIO PEDAGÓGICO*

Olá ${guardianName}! 👋

Segue o relatório do(a) aluno(a) *${selectedReport.student.name}*:

📌 *${selectedReport.title}*
📅 Data: ${selectedReport.report_date ? format(parseISO(selectedReport.report_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
👨‍🏫 Professor(a): ${selectedReport.teacher?.name || '-'}

${selectedReport.content}

---
${branding?.name || 'Circuito Kids'}`;

      const { error } = await supabase.functions.invoke('wapi-send-message', {
        body: {
          phone,
          message,
          instanceId: wapiSession,
        },
      });

      if (error) throw error;

      // Update report status locally
      const updateReports = (reports: StudentReport[]) =>
        reports.map(r => r.id === selectedReport.id ? { ...r, status: 'sent', sent_at: new Date().toISOString() } : r);
      
      setWeeklyReports(updateReports);
      setPedagogicalReports(updateReports);

      toast({
        title: 'Relatório enviado!',
        description: `Enviado para ${selectedReport.student.guardian.name}`,
      });

      setIsViewModalOpen(false);
    } catch (error) {
      console.error('Error sending report:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Verifique a configuração do WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const renderReportsTable = (reports: StudentReport[]) => {
    const filtered = getFilteredReports(reports);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum relatório encontrado</p>
          <p className="text-sm">Os relatórios enviados pelo sistema externo aparecerão aqui</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Turma/Aluno</TableHead>
              <TableHead>Professor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{report.turma || report.student?.name || '-'}</span>
                  </div>
                </TableCell>
                <TableCell>{report.teacher?.name || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {report.week_start && report.week_end ? (
                      <span>
                        {format(parseISO(report.week_start), 'dd/MM', { locale: ptBR })} - {format(parseISO(report.week_end), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    ) : report.report_date ? (
                      format(parseISO(report.report_date), 'dd/MM/yyyy', { locale: ptBR })
                    ) : '-'}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(report.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewReport(report)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios de Alunos
              </CardTitle>
              <CardDescription>
                Visualize, imprima e envie relatórios recebidos via API
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-4 mb-6 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por aluno, título ou professor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v); }}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Professor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os professores</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); }}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Rascunho</SelectItem>
                <SelectItem value="sent">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs for report types */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="pedagogical" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Pedagógicos ({pedagogicalReports.length})
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Semanais ({weeklyReports.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pedagogical">
              {renderReportsTable(pedagogicalReports)}
            </TabsContent>

            <TabsContent value="weekly">
              {renderReportsTable(weeklyReports)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* View/Print/Send Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedReport?.title}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div id="report-print-content" className="space-y-4 p-4">
              {/* Meta Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground block">Turma/Aluno</span>
                  <span className="font-medium">{selectedReport?.turma || selectedReport?.student?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Professor</span>
                  <span className="font-medium">{selectedReport?.teacher?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Período</span>
                  <span className="font-medium">
                    {selectedReport?.week_start && selectedReport?.week_end ? (
                      `${format(parseISO(selectedReport.week_start), 'dd/MM', { locale: ptBR })} - ${format(parseISO(selectedReport.week_end), 'dd/MM/yyyy', { locale: ptBR })}`
                    ) : selectedReport?.report_date ? (
                      format(parseISO(selectedReport.report_date), 'dd/MM/yyyy', { locale: ptBR })
                    ) : '-'}
                  </span>
                </div>
              </div>

              {/* Weekly Content Sections */}
              {selectedReport?.weekly_content && (
                <div className="space-y-4">
                  {selectedReport.weekly_content.desempenho_geral && (
                    <div className="p-4 border rounded-lg">
                      <span className="text-xs text-muted-foreground block mb-1">📊 Desempenho Geral</span>
                      <p className="text-sm">{selectedReport.weekly_content.desempenho_geral}</p>
                    </div>
                  )}
                  {selectedReport.weekly_content.pontos_positivos && (
                    <div className="p-4 border rounded-lg border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                      <span className="text-xs text-green-700 dark:text-green-400 block mb-1">✅ Pontos Positivos</span>
                      <p className="text-sm">{selectedReport.weekly_content.pontos_positivos}</p>
                    </div>
                  )}
                  {selectedReport.weekly_content.dificuldades && (
                    <div className="p-4 border rounded-lg border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                      <span className="text-xs text-amber-700 dark:text-amber-400 block mb-1">⚠️ Dificuldades</span>
                      <p className="text-sm">{selectedReport.weekly_content.dificuldades}</p>
                    </div>
                  )}
                  {selectedReport.weekly_content.recomendacoes && (
                    <div className="p-4 border rounded-lg border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
                      <span className="text-xs text-blue-700 dark:text-blue-400 block mb-1">💡 Recomendações</span>
                      <p className="text-sm">{selectedReport.weekly_content.recomendacoes}</p>
                    </div>
                  )}
                  {selectedReport.weekly_content.observacoes && (
                    <div className="p-4 border rounded-lg">
                      <span className="text-xs text-muted-foreground block mb-1">📝 Observações</span>
                      <p className="text-sm">{selectedReport.weekly_content.observacoes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback for non-weekly content */}
              {!selectedReport?.weekly_content && selectedReport?.content && (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedReport.content}
                  </div>
                </div>
              )}

              {/* Guardian Info */}
              {selectedReport?.student?.guardian && (
                <div className="p-4 border rounded-lg mt-4">
                  <span className="text-xs text-muted-foreground block mb-1">Responsável</span>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedReport.student.guardian.name}</span>
                    <Badge variant="outline">{selectedReport.student.guardian.phone}</Badge>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button 
              onClick={handleSendWhatsApp} 
              disabled={isSending || !selectedReport?.student?.guardian?.phone}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
