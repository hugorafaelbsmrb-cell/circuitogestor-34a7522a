import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  BookOpen, 
  Brain, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  User, 
  MessageSquare,
  GraduationCap,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  CalendarIcon
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  course_id: string | null;
}

interface HomeworkAnalysis {
  messageId: string;
  phone: string;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  hasImage?: boolean;
  createdAt: string;
  guardianId: string;
  guardianName: string;
  sourcePhone?: string;
  studentId?: string;
  studentName?: string;
  studentNames?: string;
  analysis: {
    studentName?: string;
    subjects?: string[];
    activities?: {
      subject: string;
      description: string;
      status: string;
    }[];
    summary?: string;
    parentNotes?: string;
    confidence: number;
    hasImageContent?: boolean;
    imageDescription?: string;
    sourceInfo?: string;
  };
  selectedTeacherId?: string;
  selected?: boolean;
  isSending?: boolean;
}

interface PendingReport {
  id: string;
  original_message: string;
  processed_content: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  teacher_id: string | null;
  guardians?: { name: string } | null;
  students?: { name: string } | null;
  teachers?: { name: string } | null;
}

interface SentReport {
  id: string;
  original_message: string;
  processed_content: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  teacher_id: string | null;
  guardians?: { name: string } | null;
  students?: { name: string } | null;
  teachers?: { name: string } | null;
}

export default function HomeworkAnalysis() {
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [analyzedMessages, setAnalyzedMessages] = useState<HomeworkAnalysis[]>([]);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [sentReports, setSentReports] = useState<SentReport[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scanStats, setScanStats] = useState({ total: 0, analyzed: 0, found: 0 });
  const [activeTab, setActiveTab] = useState<'scan' | 'pending' | 'sent'>('pending');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 1));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [periodPreset, setPeriodPreset] = useState<string>('yesterday');

  useEffect(() => {
    fetchTeachers();
    fetchPendingReports();
    fetchSentReports();
  }, []);

  const handlePeriodPreset = (preset: string) => {
    setPeriodPreset(preset);
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateFrom(today);
        setDateTo(today);
        break;
      case 'yesterday':
        setDateFrom(subDays(today, 1));
        setDateTo(subDays(today, 1));
        break;
      case 'last3days':
        setDateFrom(subDays(today, 3));
        setDateTo(today);
        break;
      case 'last7days':
        setDateFrom(subDays(today, 7));
        setDateTo(today);
        break;
      case 'custom':
        // Keep current dates for custom
        break;
    }
  };

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('id, name, phone, course_id')
      .eq('is_active', true)
      .order('name');
    
    if (data) setTeachers(data);
  };

  const fetchPendingReports = async () => {
    const { data } = await supabase
      .from('homework_reports')
      .select(`
        id,
        original_message,
        processed_content,
        status,
        created_at,
        sent_at,
        teacher_id,
        guardians (name),
        students (name),
        teachers (name)
      `)
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: false });
    
    if (data) setPendingReports(data as PendingReport[]);
  };

  const fetchSentReports = async () => {
    const { data } = await supabase
      .from('homework_reports')
      .select(`
        id,
        original_message,
        processed_content,
        status,
        created_at,
        sent_at,
        teacher_id,
        guardians (name),
        students (name),
        teachers (name)
      `)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(50);
    
    if (data) setSentReports(data as SentReport[]);
  };

  const scanMessages = async () => {
    setIsScanning(true);
    try {
      const body: any = { action: 'scan' };
      
      if (dateFrom) {
        body.dateFrom = startOfDay(dateFrom).toISOString();
      }
      if (dateTo) {
        body.dateTo = endOfDay(dateTo).toISOString();
      }

      const { data, error } = await supabase.functions.invoke('analyze-homework-messages', {
        body
      });

      if (error) throw error;

      setAnalyzedMessages(data.results.map((r: HomeworkAnalysis) => ({ ...r, selected: true })));
      setScanStats({
        total: data.total,
        analyzed: data.analyzed,
        found: data.homeworkFound
      });

      if (data.homeworkFound > 0) {
        toast.success(`${data.homeworkFound} mensagens com dever de casa encontradas!`);
        setActiveTab('scan');
      } else {
        toast.info('Nenhuma mensagem nova com dever de casa encontrada');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Erro ao analisar mensagens');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    setAnalyzedMessages(prev => 
      prev.map(m => m.messageId === messageId ? { ...m, selected: !m.selected } : m)
    );
  };

  const setTeacherForMessage = (messageId: string, teacherId: string) => {
    setAnalyzedMessages(prev =>
      prev.map(m => m.messageId === messageId ? { ...m, selectedTeacherId: teacherId } : m)
    );
  };

  const setTeacherForPending = async (reportId: string, teacherId: string) => {
    const { error } = await supabase
      .from('homework_reports')
      .update({ teacher_id: teacherId })
      .eq('id', reportId);

    if (!error) {
      setPendingReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, teacher_id: teacherId } : r)
      );
      toast.success('Professor atribuído');
    }
  };

  const sendToTeachers = async () => {
    const selectedMessages = analyzedMessages.filter(m => m.selected && m.selectedTeacherId);
    
    if (selectedMessages.length === 0) {
      toast.error('Selecione mensagens e atribua professores');
      return;
    }

    setIsSending(true);
    let successCount = 0;

    try {
      for (const msg of selectedMessages) {
        await sendSingleMessage(msg);
        successCount++;
      }

      toast.success(`${successCount} relatórios enviados com sucesso!`);
      setAnalyzedMessages(prev => prev.filter(m => !m.selected || !m.selectedTeacherId));
      fetchPendingReports();
      fetchSentReports();
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Erro ao enviar relatórios');
    } finally {
      setIsSending(false);
    }
  };

  const sendSingleMessage = async (msg: HomeworkAnalysis) => {
    const teacher = teachers.find(t => t.id === msg.selectedTeacherId);
    if (!teacher) {
      toast.error('Selecione um professor primeiro');
      return false;
    }

    const formattedMessage = formatHomeworkMessage(msg, teacher);

    try {
      console.log('Enviando dever para professor:', teacher.name, teacher.phone);
      
      const { data, error } = await supabase.functions.invoke('wapi-send-message', {
        body: { 
          phone: teacher.phone, 
          message: formattedMessage 
        }
      });

      console.log('Resposta do envio:', { data, error });

      // Check if there was an invoke error
      if (error) {
        console.error('Erro ao invocar função:', error);
        toast.error(`Erro ao enviar: ${error.message || 'Falha na comunicação'}`);
        return false;
      }

      // Check if W-API returned success - the edge function returns { success: true } OR messageId in data
      const isSuccess = data?.success === true || data?.data?.messageId || data?.messageId;
      if (!isSuccess && data?.error) {
        console.error('W-API retornou erro:', data);
        toast.error(`Erro do WhatsApp: ${data?.error || 'Falha no envio'}`);
        return false;
      }

      // Success - save to homework_reports
      await supabase.from('homework_reports').insert({
        whatsapp_message_id: msg.messageId,
        guardian_id: msg.guardianId,
        student_id: msg.studentId || null,
        teacher_id: teacher.id,
        original_message: msg.message,
        processed_content: formattedMessage,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      setAnalyzedMessages(prev => prev.filter(m => m.messageId !== msg.messageId));
      toast.success(`Relatório enviado para ${teacher.name}!`);
      return true;
    } catch (err) {
      console.error('Erro inesperado ao enviar:', err);
      toast.error('Erro inesperado ao enviar mensagem');
      return false;
    }
  };

  const sendPendingReport = async (report: PendingReport) => {
    if (!report.teacher_id) {
      toast.error('Selecione um professor primeiro');
      return;
    }

    const teacher = teachers.find(t => t.id === report.teacher_id);
    if (!teacher) return;

    try {
      let messageToSend = report.processed_content;
      
      // If processed_content is JSON, format it
      try {
        const parsed = JSON.parse(report.processed_content);
        messageToSend = formatParsedHomework(parsed, report.guardians?.name);
      } catch {
        // Use as-is if not JSON
      }

      console.log('Enviando relatório pendente para:', teacher.name, teacher.phone);

      const { data, error } = await supabase.functions.invoke('wapi-send-message', {
        body: { phone: teacher.phone, message: messageToSend }
      });

      console.log('Resposta do envio pendente:', { data, error });

      if (error) {
        throw new Error(error.message || 'Erro ao invocar função');
      }

      // Check if W-API returned success - the edge function returns { success: true } OR messageId in data
      const isSuccess = data?.success === true || data?.data?.messageId || data?.messageId;
      if (!isSuccess && data?.error) {
        throw new Error(data?.error || 'Falha no envio via WhatsApp');
      }

      await supabase
        .from('homework_reports')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', report.id);

      toast.success('Relatório enviado!');
      fetchPendingReports();
      fetchSentReports();
    } catch (error) {
      console.error('Send error:', error);
      toast.error(`Erro ao enviar: ${error instanceof Error ? error.message : 'Falha desconhecida'}`);
    }
  };

  const formatHomeworkMessage = (msg: HomeworkAnalysis, teacher: Teacher): string => {
    const studentName = msg.analysis.studentName || 'Aluno';
    let text = `📚 *Roteiro de Atividades - ${studentName}*\n`;
    text += `👤 Responsável: ${msg.guardianName}\n\n`;

    if (msg.analysis.summary) {
      text += `📋 *Resumo:* ${msg.analysis.summary}\n\n`;
    }

    if (msg.analysis.activities && msg.analysis.activities.length > 0) {
      text += `📖 *Atividades:*\n`;
      msg.analysis.activities.forEach((act, i) => {
        const emoji = act.status === 'realizada' ? '✅' : act.status === 'parcial' ? '⚠️' : '❌';
        text += `${i + 1}. ${emoji} ${act.subject}: ${act.description}\n`;
      });
      text += '\n';
    }

    if (msg.analysis.parentNotes) {
      text += `💬 *Obs. do responsável:* ${msg.analysis.parentNotes}\n\n`;
    }

    text += `_Recebido em ${format(new Date(msg.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}_`;
    return text;
  };

  const formatParsedHomework = (parsed: any, guardianName?: string): string => {
    let text = `📚 *Roteiro de Atividades*\n`;
    if (guardianName) text += `👤 Responsável: ${guardianName}\n\n`;

    if (parsed.summary) text += `📋 ${parsed.summary}\n\n`;

    if (parsed.activities?.length > 0) {
      text += `📖 *Atividades:*\n`;
      parsed.activities.forEach((act: any, i: number) => {
        const emoji = act.status === 'realizada' ? '✅' : act.status === 'parcial' ? '⚠️' : '❌';
        text += `${i + 1}. ${emoji} ${act.subject || 'Geral'}: ${act.description}\n`;
      });
    }

    return text;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Análise de Deveres de Casa</h1>
              <p className="text-muted-foreground">
                IA analisa mensagens e extrai informações de atividades escolares
              </p>
            </div>
          </div>
        </div>

        {/* Period Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Período:</span>
              </div>
              
              <Select value={periodPreset} onValueChange={handlePeriodPreset}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="last3days">Últimos 3 dias</SelectItem>
                  <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {periodPreset === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-36 justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-36 justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}

              {periodPreset !== 'custom' && dateFrom && dateTo && (
                <Badge variant="secondary" className="text-xs">
                  {format(dateFrom, "dd/MM", { locale: ptBR })} - {format(dateTo, "dd/MM", { locale: ptBR })}
                </Badge>
              )}

              <Button onClick={scanMessages} disabled={isScanning} className="ml-auto">
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Analisar Mensagens
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      {scanStats.total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{scanStats.total}</p>
                <p className="text-sm text-muted-foreground">Total de mensagens</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Brain className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{scanStats.analyzed}</p>
                <p className="text-sm text-muted-foreground">Analisadas pela IA</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{scanStats.found}</p>
                <p className="text-sm text-muted-foreground">Deveres encontrados</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button 
          variant={activeTab === 'pending' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('pending')}
          className="rounded-b-none"
        >
          <Clock className="w-4 h-4 mr-2" />
          Pendentes ({pendingReports.length})
        </Button>
        <Button 
          variant={activeTab === 'scan' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('scan')}
          className="rounded-b-none"
        >
          <Brain className="w-4 h-4 mr-2" />
          Novas Análises ({analyzedMessages.length})
        </Button>
        <Button 
          variant={activeTab === 'sent' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('sent')}
          className="rounded-b-none"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Enviados ({sentReports.length})
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'scan' && (
        <div className="space-y-4">
          {analyzedMessages.length > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {analyzedMessages.filter(m => m.selected).length} selecionadas
              </p>
              <Button onClick={sendToTeachers} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar para Professores
              </Button>
            </div>
          )}

          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {analyzedMessages.map((msg) => (
                <Card key={msg.messageId} className={msg.selected ? 'ring-2 ring-primary' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={msg.selected}
                          onCheckedChange={() => toggleMessageSelection(msg.messageId)}
                        />
                        <div>
                          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <GraduationCap className="w-4 h-4 text-primary" />
                              <span className="font-bold">{msg.studentName || msg.analysis.studentName || 'Aluno não identificado'}</span>
                            </div>
                            <span className="text-muted-foreground">•</span>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="w-4 h-4" />
                              <span className="font-normal text-sm">
                                {msg.guardianName || 'Grupo/Escola'}
                              </span>
                            </div>
                          </CardTitle>
                          <CardDescription className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{format(new Date(msg.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                              {(msg.sourcePhone || msg.phone) && (
                                <Badge variant="outline" className="text-xs font-normal">
                                  📱 {msg.sourcePhone || msg.phone}
                                </Badge>
                              )}
                            </div>
                            {(msg.studentNames || msg.analysis.studentName) && (
                              <div className="flex items-center gap-1 text-sm">
                                <span className="text-muted-foreground">👨‍🎓 Aluno(s):</span>
                                <span className="font-medium text-foreground">
                                  {msg.studentNames || msg.analysis.studentName}
                                </span>
                              </div>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {Math.round(msg.analysis.confidence * 100)}% confiança
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Image preview if present */}
                    {msg.hasImage && msg.mediaUrl && (
                      <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                          <ImageIcon className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Imagem analisada pela IA</span>
                        </div>
                        <img 
                          src={msg.mediaUrl} 
                          alt="Imagem da mensagem" 
                          className="max-w-xs rounded-lg border shadow-sm"
                        />
                        {msg.analysis.imageDescription && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            🔍 {msg.analysis.imageDescription}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Original message */}
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">{msg.message || "(apenas imagem)"}</p>
                    </div>

                    {/* AI Analysis */}
                    {msg.analysis.summary && (
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-sm font-medium">
                          📋 {msg.analysis.summary}
                        </p>
                      </div>
                    )}

                    {msg.analysis.activities && msg.analysis.activities.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Atividades identificadas:</p>
                        {msg.analysis.activities.map((act, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {act.status === 'realizada' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : act.status === 'parcial' ? (
                              <AlertCircle className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="font-medium">{act.subject}:</span>
                            <span className="text-muted-foreground">{act.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Teacher selection and individual send */}
                    <div className="flex items-center gap-4 pt-2 border-t flex-wrap">
                      <span className="text-sm font-medium">Enviar para:</span>
                      <Select 
                        value={msg.selectedTeacherId || ''} 
                        onValueChange={(v) => setTeacherForMessage(msg.messageId, v)}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Selecione um professor" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        size="sm"
                        onClick={() => sendSingleMessage(msg)}
                        disabled={!msg.selectedTeacherId || msg.isSending}
                      >
                        {msg.isSending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {analyzedMessages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em "Analisar Mensagens" para buscar deveres de casa</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {activeTab === 'pending' && (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {pendingReports.map((report) => {
              let parsedContent: any = {};
              try {
                parsedContent = JSON.parse(report.processed_content);
              } catch {
                parsedContent = { summary: report.processed_content };
              }

              return (
                <Card key={report.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {report.guardians?.name || 'Responsável'}
                          {report.students?.name && (
                            <Badge variant="outline">
                              <GraduationCap className="w-3 h-3 mr-1" />
                              {report.students.name}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </CardDescription>
                      </div>
                      <Badge variant={report.status === 'failed' ? 'destructive' : 'secondary'}>
                        {report.status === 'failed' ? 'Falha' : 'Pendente'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">{report.original_message}</p>
                    </div>

                    {parsedContent.summary && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          📋 {parsedContent.summary}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2 border-t">
                      <span className="text-sm font-medium">Professor:</span>
                      <Select 
                        value={report.teacher_id || ''} 
                        onValueChange={(v) => setTeacherForPending(report.id, v)}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Selecione um professor" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        size="sm"
                        onClick={() => sendPendingReport(report)}
                        disabled={!report.teacher_id}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Enviar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {pendingReports.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório pendente</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {activeTab === 'sent' && (
        <SentReportsTab 
          sentReports={sentReports}
          teachers={teachers}
          onResend={async (reportId, teacherId) => {
            const report = sentReports.find(r => r.id === reportId);
            if (!report) return;
            
            const teacher = teachers.find(t => t.id === teacherId);
            if (!teacher) {
              toast.error('Selecione um professor');
              return;
            }

            try {
              let messageToSend = report.processed_content;
              try {
                const parsed = JSON.parse(report.processed_content);
                messageToSend = formatParsedHomework(parsed, report.guardians?.name);
              } catch {
                // Use as-is
              }

              console.log('Reenviando para professor:', teacher.name, teacher.phone);

              const { data, error } = await supabase.functions.invoke('wapi-send-message', {
                body: { phone: teacher.phone, message: messageToSend }
              });

              console.log('Resposta do reenvio:', { data, error });

              if (error) {
                throw new Error(error.message || 'Erro ao invocar função');
              }

              // Check if W-API returned success - the edge function returns { success: true } OR messageId in data
              const isSuccess = data?.success === true || data?.data?.messageId || data?.messageId;
              if (!isSuccess && data?.error) {
                throw new Error(data?.error || 'Falha no envio via WhatsApp');
              }

              // Update the existing record with new teacher and resent timestamp
              await supabase
                .from('homework_reports')
                .update({ 
                  teacher_id: teacherId, 
                  sent_at: new Date().toISOString() 
                })
                .eq('id', reportId);

              toast.success(`Reenviado para ${teacher.name}!`);
              fetchSentReports();
            } catch (error) {
              console.error('Resend error:', error);
              toast.error(`Erro ao reenviar: ${error instanceof Error ? error.message : 'Falha desconhecida'}`);
            }
          }}
        />
      )}
    </div>
  );
}

// Separated component for sent reports tab
interface SentReportsTabProps {
  sentReports: SentReport[];
  teachers: Teacher[];
  onResend: (reportId: string, teacherId: string) => Promise<void>;
}

const SentReportsTab = ({ sentReports, teachers, onResend }: SentReportsTabProps) => {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Record<string, string>>({});

  const handleResend = async (reportId: string) => {
    const teacherId = selectedTeachers[reportId];
    if (!teacherId) {
      toast.error('Selecione um professor');
      return;
    }
    setResendingId(reportId);
    try {
      await onResend(reportId, teacherId);
    } finally {
      setResendingId(null);
    }
  };

  const handleTeacherSelect = (reportId: string, teacherId: string) => {
    setSelectedTeachers(prev => ({ ...prev, [reportId]: teacherId }));
  };

  if (sentReports.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum dever enviado ainda</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4">
        {sentReports.map((report) => {
          let parsedContent: { summary?: string } = {};
          try {
            parsedContent = JSON.parse(report.processed_content);
          } catch {
            parsedContent = { summary: report.processed_content };
          }

          const selectedTeacherId = selectedTeachers[report.id] || '';
          const isResending = resendingId === report.id;

          return (
            <Card key={report.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{report.guardians?.name || 'Responsável'}</span>
                      {report.students?.name && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                          <GraduationCap className="w-3 h-3 mr-1" />
                          {report.students.name}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="flex flex-col gap-1">
                      <span>
                        Criado: {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {report.sent_at && (
                        <span className="text-green-600 dark:text-green-400">
                          ✓ Enviado: {format(new Date(report.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.teachers?.name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        <User className="w-3 h-3 mr-1" />
                        {report.teachers.name}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Enviado
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm line-clamp-3">{report.original_message}</p>
                </div>

                {parsedContent.summary && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <p className="text-sm">📋 {parsedContent.summary}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t flex-wrap">
                  <span className="text-sm font-medium">Reenviar para:</span>
                  <Select 
                    value={selectedTeacherId} 
                    onValueChange={(value) => handleTeacherSelect(report.id, value)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Selecione outro professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => handleResend(report.id)}
                    disabled={isResending || !selectedTeacherId}
                  >
                    {isResending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Reenviar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};