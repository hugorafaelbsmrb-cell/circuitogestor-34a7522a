import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Send, 
  Users, 
  Filter,
  MessageSquare,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  GraduationCap,
  Save,
  FileText,
  Clock,
  Trash2,
  Calendar,
  Loader2,
  Sparkles,
  Wand2,
  Zap,
  Image as ImageIcon,
  Link2,
  Upload
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSchool } from '@/contexts/SchoolContext';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvancedMessagesPanel } from '@/components/whatsapp/AdvancedMessagesPanel';
import { useAIProvider } from '@/hooks/useAIProvider';

interface Recipient {
  id: string;
  name: string;
  phone: string;
  type: 'guardian';
  courseIds: string[];
  studentNames: string[];
  courseNames: string[];
}

interface MessageTemplate {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

interface ScheduledMessage {
  id: string;
  message: string;
  course_filter: string;
  recipient_ids: string[];
  scheduled_at: string;
  status: string;
  sent_count: number;
  error_count: number;
  created_at: string;
}

type SendStatus = 'idle' | 'sending' | 'completed';

interface SendResult {
  recipientId: string;
  success: boolean;
  error?: string;
}

const SEND_DELAY_MS = 3500;

export default function BulkMessages() {
  const { guardians, students, courses, enrollments, classGroups } = useSchool();
  const { sendMessage, checkConfig } = useWapiMessage();
  const { toast } = useToast();
  const { getGenerateFunctionName } = useAIProvider();

  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateName, setTemplateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Scheduling state
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(true);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  // AI generation state
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState('profissional e amigável');
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
  const aiCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (aiCooldownTimeoutRef.current) {
        clearTimeout(aiCooldownTimeoutRef.current);
      }
    };
  }, []);

  const parseInvokeError = (err: any): { status?: number; body?: any } => {
    const status: number | undefined =
      err?.context?.status ?? err?.status ?? err?.context?.response?.status;

    const rawBody = err?.context?.body ?? err?.context?.response?.body;
    if (!rawBody) return { status };

    if (typeof rawBody === 'string') {
      try {
        return { status, body: JSON.parse(rawBody) };
      } catch {
        return { status, body: { error: rawBody } };
      }
    }

    return { status, body: rawBody };
  };

  // Load templates and scheduled messages
  useEffect(() => {
    loadTemplates();
    loadScheduledMessages();
  }, []);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      // Load from bulk_message_templates table
      const { data: bulkData, error: bulkError } = await supabase
        .from('bulk_message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (bulkError) throw bulkError;

      // Also load from app_settings (whatsapp templates)
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')
        .like('key', 'whatsapp_template_%');

      const settingsTemplates: MessageTemplate[] = (settingsData || []).map(setting => {
        try {
          const p = JSON.parse(setting.value || '{}');
          return {
            id: setting.id,
            name: p.name || setting.key.replace('whatsapp_template_', ''),
            message: p.message || '',
            created_at: setting.created_at,
          };
        } catch {
          return {
            id: setting.id,
            name: setting.key.replace('whatsapp_template_', ''),
            message: setting.value || '',
            created_at: setting.created_at,
          };
        }
      }).filter(t => t.message.length > 0);

      setTemplates([...(bulkData || []), ...settingsTemplates]);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadScheduledMessages = async () => {
    setIsLoadingScheduled(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_bulk_messages')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setScheduledMessages(data || []);
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    } finally {
      setIsLoadingScheduled(false);
    }
  };

  // Helper to get first name only
  const getFirstName = (fullName: string): string => {
    return fullName.trim().split(' ')[0] || fullName;
  };

  // Helper to get first and last name
  const getFirstAndLastName = (fullName: string): string => {
    const parts = fullName.trim().split(' ').filter(Boolean);
    if (parts.length <= 1) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  // Build recipients list with course associations
  const recipients = useMemo(() => {
    const recipientMap = new Map<string, Recipient>();

    guardians.forEach(guardian => {
      const guardianStudents = students.filter(s => s.guardian_id === guardian.id);
      const courseIds = new Set<string>();
      const studentNames: string[] = [];

      guardianStudents.forEach(student => {
        // Use first and last name for students
        studentNames.push(getFirstAndLastName(student.name));
        const studentEnrollments = enrollments.filter(e => e.student_id === student.id && e.status === 'active');
        studentEnrollments.forEach(enrollment => {
          const classGroup = classGroups.find(cg => cg.id === enrollment.class_group_id);
          if (classGroup) {
            courseIds.add(classGroup.course_id);
          }
        });
      });

      const courseNames = Array.from(courseIds)
        .map(id => courses.find(c => c.id === id)?.name)
        .filter(Boolean) as string[];

      recipientMap.set(guardian.id, {
        id: guardian.id,
        name: getFirstName(guardian.name), // Store only first name for guardian
        phone: guardian.phone,
        type: 'guardian',
        courseIds: Array.from(courseIds),
        studentNames,
        courseNames,
      });
    });

    return Array.from(recipientMap.values());
  }, [guardians, students, enrollments, classGroups, courses]);

  // Filter recipients by selected course
  const filteredRecipients = useMemo(() => {
    if (selectedCourse === 'all') {
      return recipients;
    }
    return recipients.filter(r => r.courseIds.includes(selectedCourse));
  }, [recipients, selectedCourse]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecipients(new Set(filteredRecipients.map(r => r.id)));
    } else {
      setSelectedRecipients(new Set());
    }
  };

  const handleSelectRecipient = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRecipients);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRecipients(newSelected);
  };

  const getCourseNames = (courseIds: string[]) => {
    return courseIds
      .map(id => courses.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem.', variant: 'destructive' });
      return;
    }
    setIsUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `bulk/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('campaign-images').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('campaign-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast({ title: 'Imagem carregada', description: 'Pronta para envio.' });
    } catch (err) {
      toast({
        title: 'Erro no upload',
        description: err instanceof Error ? err.message : 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const logMessage = async (
    phone: string,
    guardianId: string,
    status: 'success' | 'error',
    preview: string,
    errorMessage?: string
  ) => {
    try {
      await supabase.from('message_logs').insert({
        phone,
        guardian_id: guardianId,
        template_category: 'bulk_manual',
        message_preview: preview.substring(0, 100),
        automation_key: 'bulk_messages_page',
        status,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Error logging message:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim() && !imageUrl && !linkUrl.trim()) {
      toast({
        title: 'Mensagem vazia',
        description: 'Digite uma mensagem, anexe uma imagem ou adicione um link para enviar.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedRecipients.size === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável para enviar.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API em Configurações > WhatsApp antes de enviar.',
        variant: 'destructive',
      });
      return;
    }

    setSendStatus('sending');
    setSendProgress(0);
    setSendResults([]);

    const recipientsToSend = filteredRecipients.filter(r => selectedRecipients.has(r.id));
    const results: SendResult[] = [];

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];
      
      // Personalize message
      let personalizedMessage = message
        .replace(/{nome_responsavel}/g, recipient.name)
        .replace(/{nome}/g, recipient.name)
        .replace(/{nome_aluno}/g, recipient.studentNames[0] || '')
        .replace(/{nomes_alunos}/g, recipient.studentNames.join(', ') || '')
        .replace(/{curso}/g, recipient.courseNames[0] || '')
        .replace(/{cursos}/g, recipient.courseNames.join(', ') || '');

      if (linkUrl.trim()) {
        personalizedMessage = `${personalizedMessage}\n\n${linkUrl.trim()}`;
      }

      const success = await sendMessage(
        imageUrl
          ? {
              phone: recipient.phone,
              message: personalizedMessage,
              mediaUrl: imageUrl,
              mediaType: 'image',
              caption: personalizedMessage,
            }
          : { phone: recipient.phone, message: personalizedMessage }
      );

      const result: SendResult = {
        recipientId: recipient.id,
        success,
        error: success ? undefined : 'Falha no envio',
      };

      results.push(result);
      setSendResults([...results]);
      
      const preview = (imageUrl ? '[IMG] ' : '') + personalizedMessage;
      await logMessage(
        recipient.phone,
        recipient.id,
        success ? 'success' : 'error',
        preview,
        success ? undefined : 'Falha no envio'
      );

      const progress = ((i + 1) / recipientsToSend.length) * 100;
      setSendProgress(progress);

      // Rate limiting delay
      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setSendStatus('completed');
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    toast({
      title: 'Envio concluído',
      description: `${successCount} mensagens enviadas com sucesso${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
    });
  };

  const handleReset = () => {
    setSendStatus('idle');
    setSendProgress(0);
    setSendResults([]);
    setSelectedRecipients(new Set());
    setMessage('');
    setImageUrl('');
    setLinkUrl('');
  };

  // Template functions
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !message.trim()) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha o nome e a mensagem do template.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('bulk_message_templates')
        .insert({
          name: templateName.trim(),
          message: message.trim(),
        });

      if (error) throw error;

      toast({
        title: 'Template salvo',
        description: 'Mensagem salva como template com sucesso.',
      });

      setShowSaveDialog(false);
      setTemplateName('');
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o template.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (template: MessageTemplate) => {
    setMessage(template.message);
    toast({
      title: 'Template carregado',
      description: `"${template.name}" foi carregado no editor.`,
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bulk_message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Template excluído',
        description: 'Template removido com sucesso.',
      });
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o template.',
        variant: 'destructive',
      });
    }
  };

  // Schedule functions
  const handleScheduleMessage = async () => {
    if (!message.trim() || !scheduleDate || !scheduleTime) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha a mensagem, data e hora do agendamento.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedRecipients.size === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável.',
        variant: 'destructive',
      });
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      toast({
        title: 'Data inválida',
        description: 'A data de agendamento deve ser no futuro.',
        variant: 'destructive',
      });
      return;
    }

    setIsScheduling(true);
    try {
      const { error } = await supabase
        .from('scheduled_bulk_messages')
        .insert({
          message: message.trim(),
          course_filter: selectedCourse,
          recipient_ids: Array.from(selectedRecipients),
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Mensagem agendada',
        description: `Envio programado para ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
      });

      setShowScheduleDialog(false);
      setScheduleDate('');
      setScheduleTime('');
      loadScheduledMessages();
    } catch (error) {
      console.error('Error scheduling message:', error);
      toast({
        title: 'Erro ao agendar',
        description: 'Não foi possível agendar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_bulk_messages')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Agendamento cancelado',
        description: 'O envio foi cancelado com sucesso.',
      });
      loadScheduledMessages();
    } catch (error) {
      console.error('Error cancelling scheduled message:', error);
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar o agendamento.',
        variant: 'destructive',
      });
    }
  };

  // AI Generation function
  const handleGenerateWithAI = async () => {
    if (aiCooldownUntil && Date.now() < aiCooldownUntil) {
      toast({
        title: 'Aguarde para tentar novamente',
        description: 'O serviço de IA limitou as requisições. Aguarde alguns instantes e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    if (!aiPurpose.trim()) {
      toast({
        title: 'Propósito obrigatório',
        description: 'Descreva o propósito da mensagem.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const functionName = getGenerateFunctionName();
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          purpose: aiPurpose,
          tone: aiTone,
          context: aiContext,
        },
      });

      if (error) throw error;

      if (data?.message) {
        setMessage(data.message);
        setShowAIDialog(false);
        setAiPurpose('');
        setAiContext('');
        toast({
          title: 'Mensagem gerada',
          description: 'A IA criou uma mensagem para você. Revise e edite se necessário.',
        });
      } else {
        throw new Error('Nenhuma mensagem gerada');
      }
    } catch (error: any) {
      const parsed = parseInvokeError(error);
      if (parsed.status === 429) {
        const retryAfterSeconds = Number(parsed.body?.retry_after_seconds ?? 60);
        const ms = Math.min(Math.max(retryAfterSeconds, 5), 600) * 1000;

        setAiCooldownUntil(Date.now() + ms);
        if (aiCooldownTimeoutRef.current) clearTimeout(aiCooldownTimeoutRef.current);
        aiCooldownTimeoutRef.current = setTimeout(() => setAiCooldownUntil(null), ms);

        // Fallback automático para o provedor interno (evita travar o fluxo por rate limit externo)
        try {
          const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke(
            'generate-message',
            {
              body: {
                purpose: aiPurpose,
                tone: aiTone,
                context: aiContext,
              },
            }
          );

          if (fallbackError) throw fallbackError;

          if (fallbackData?.message) {
            setMessage(fallbackData.message);
            setShowAIDialog(false);
            setAiPurpose('');
            setAiContext('');
            toast({
              title: 'Mensagem gerada (fallback)',
              description:
                'O serviço de IA principal limitou as requisições; usamos um provedor alternativo para gerar a mensagem.',
            });
            return;
          }
        } catch (fallbackErr) {
          console.error('AI fallback error:', fallbackErr);
        }

        toast({
          title: 'Limite de requisições (IA)',
          description: parsed.body?.error || 'Aguarde um pouco e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      console.error('Error generating message:', error);
      toast({
        title: 'Erro ao gerar',
        description: parsed.body?.error || error.message || 'Não foi possível gerar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const allSelected = filteredRecipients.length > 0 && 
    filteredRecipients.every(r => selectedRecipients.has(r.id));
  const someSelected = filteredRecipients.some(r => selectedRecipients.has(r.id)) && !allSelected;

  const successCount = sendResults.filter(r => r.success).length;
  const errorCount = sendResults.filter(r => !r.success).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning">Pendente</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-accent-foreground border-accent">Processando</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-primary border-primary">Concluído</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Envio em Massa</h1>
        <p className="page-subtitle">Envie mensagens WhatsApp para múltiplos responsáveis</p>
      </div>

      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="compose" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Compor
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <Zap className="w-4 h-4" />
            Avançado
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="w-4 h-4" />
            Agendados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Message Composer */}
            <Card>
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Compor Mensagem
              </CardTitle>
              <CardDescription>
                Clique nas variáveis para inserir na mensagem
              </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Clickable Variables */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Variáveis de personalização</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { variable: '{nome_responsavel}', label: 'Nome Responsável', description: 'Primeiro nome do responsável' },
                      { variable: '{nome_aluno}', label: 'Nome Aluno', description: 'Nome e sobrenome do aluno' },
                      { variable: '{nomes_alunos}', label: 'Nomes Alunos', description: 'Todos os alunos do responsável' },
                      { variable: '{curso}', label: 'Curso', description: 'Nome do curso principal' },
                      { variable: '{cursos}', label: 'Cursos', description: 'Todos os cursos matriculados' },
                    ].map((item) => (
                      <Button
                        key={item.variable}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const textarea = document.getElementById('message') as HTMLTextAreaElement;
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const newMessage = message.substring(0, start) + item.variable + message.substring(end);
                            setMessage(newMessage);
                            // Set cursor position after the inserted variable
                            setTimeout(() => {
                              textarea.focus();
                              textarea.setSelectionRange(start + item.variable.length, start + item.variable.length);
                            }, 0);
                          } else {
                            setMessage(message + item.variable);
                          }
                        }}
                        disabled={sendStatus === 'sending'}
                        className="text-xs h-7 px-2 gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                        title={item.description}
                      >
                        <Zap className="w-3 h-3" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* AI Generator Button */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Gerar com IA</p>
                        <p className="text-xs text-muted-foreground">Deixe a IA criar a mensagem para você</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowAIDialog(true)}
                      disabled={sendStatus === 'sending'}
                      className="gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      Criar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    placeholder="Olá {nome_responsavel}, escreva sua mensagem aqui..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[180px] resize-none"
                    disabled={sendStatus === 'sending'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {message.length} caracteres
                  </p>
                </div>

                {/* Image (optional) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Imagem (opcional)
                  </Label>
                  {imageUrl ? (
                    <div className="relative inline-block">
                      <img src={imageUrl} alt="Preview" className="max-h-40 rounded-md border" />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => setImageUrl('')}
                        disabled={sendStatus === 'sending'}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Cole a URL de uma imagem..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        disabled={sendStatus === 'sending'}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage || sendStatus === 'sending'}
                        className="gap-2 shrink-0"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        Upload
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={sendStatus === 'sending'}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    A imagem será enviada com a mensagem como legenda.
                  </p>
                </div>

                {/* Link (optional) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Link (opcional)
                  </Label>
                  <Input
                    placeholder="https://... (ex: link da página da Colônia)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    disabled={sendStatus === 'sending'}
                  />
                  <p className="text-xs text-muted-foreground">
                    O link será adicionado ao final da mensagem para gerar preview no WhatsApp.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveDialog(true)}
                    disabled={!message.trim() || sendStatus === 'sending'}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Template
                  </Button>
                  <div className="relative group">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduleDialog(true)}
                      disabled={!message.trim() || selectedRecipients.size === 0 || sendStatus === 'sending'}
                      className="gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Agendar
                    </Button>
                    {(!message.trim() || selectedRecipients.size === 0) && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {!message.trim() ? 'Digite uma mensagem' : 'Selecione destinatários'}
                      </div>
                    )}
                  </div>
                </div>

                {sendStatus === 'sending' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Enviando mensagens...</span>
                      <span>{Math.round(sendProgress)}%</span>
                    </div>
                    <Progress value={sendProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {sendResults.length} de {selectedRecipients.size} enviadas
                    </p>
                  </div>
                )}

                {sendStatus === 'completed' && (
                  <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Envio concluído
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-primary">{successCount} enviadas</span>
                      {errorCount > 0 && (
                        <span className="text-destructive">{errorCount} falharam</span>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Novo envio
                    </Button>
                  </div>
                )}

                {sendStatus === 'idle' && (
                  <Button
                    onClick={handleSend}
                    disabled={selectedRecipients.size === 0 || !(message.trim() || imageUrl || linkUrl.trim())}
                    className="w-full gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar para {selectedRecipients.size} {selectedRecipients.size === 1 ? 'responsável' : 'responsáveis'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recipients Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Destinatários
                </CardTitle>
                <CardDescription>
                  Filtre e selecione os responsáveis para enviar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter by Course */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtrar por Curso
                  </Label>
                  <Select 
                    value={selectedCourse} 
                    onValueChange={(value) => {
                      setSelectedCourse(value);
                      setSelectedRecipients(new Set());
                    }}
                    disabled={sendStatus === 'sending'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um curso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os responsáveis</SelectItem>
                      {courses.filter(c => c.is_active).map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select All */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      disabled={sendStatus === 'sending'}
                      className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                    />
                    <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Selecionar todos ({filteredRecipients.length})
                    </Label>
                  </div>
                  <Badge variant="secondary">
                    {selectedRecipients.size} selecionados
                  </Badge>
                </div>

                {/* Recipients List */}
                <ScrollArea className="h-[250px] rounded-lg border">
                  <div className="p-2 space-y-1">
                    {filteredRecipients.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <p className="text-sm">Nenhum responsável encontrado</p>
                      </div>
                    ) : (
                      filteredRecipients.map(recipient => {
                        const result = sendResults.find(r => r.recipientId === recipient.id);
                        const isSelected = selectedRecipients.has(recipient.id);

                        return (
                          <div
                            key={recipient.id}
                            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors ${
                              result?.success ? 'bg-primary/10' : 
                              result?.success === false ? 'bg-destructive/10' : ''
                            }`}
                          >
                            <Checkbox
                              id={recipient.id}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectRecipient(recipient.id, checked as boolean)}
                              disabled={sendStatus === 'sending'}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{recipient.name}</p>
                              <p className="text-xs text-muted-foreground">{recipient.phone}</p>
                            </div>
                            {recipient.courseIds.length > 0 && (
                              <div className="flex items-center gap-1 shrink-0">
                                <GraduationCap className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                                  {getCourseNames(recipient.courseIds)}
                                </span>
                              </div>
                            )}
                            {result && (
                              result.success ? (
                                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive shrink-0" />
                              )
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <p className="text-lg font-bold">{filteredRecipients.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <p className="text-lg font-bold">{selectedRecipients.size}</p>
                    <p className="text-xs text-muted-foreground">Selecionados</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <p className="text-lg font-bold">{courses.filter(c => c.is_active).length}</p>
                    <p className="text-xs text-muted-foreground">Cursos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Advanced Messages Tab */}
        <TabsContent value="advanced" className="mt-6">
          <AdvancedMessagesPanel
            selectedRecipients={selectedRecipients}
            recipients={filteredRecipients}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Templates Salvos
              </CardTitle>
              <CardDescription>
                Clique em um template para carregá-lo no editor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-4" />
                  <p className="text-lg font-medium">Nenhum template salvo</p>
                  <p className="text-sm">Crie uma mensagem e salve como template para reutilizar depois.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(template => (
                    <Card 
                      key={template.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleLoadTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{template.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(template.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {template.message}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Envios Agendados
              </CardTitle>
              <CardDescription>
                Mensagens programadas para envio automático
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingScheduled ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : scheduledMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mb-4" />
                  <p className="text-lg font-medium">Nenhum envio agendado</p>
                  <p className="text-sm">Crie uma mensagem e clique em "Agendar" para programar o envio.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledMessages.map(scheduled => (
                    <Card key={scheduled.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {format(new Date(scheduled.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {getStatusBadge(scheduled.status)}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {scheduled.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{scheduled.recipient_ids.length} destinatários</span>
                              {scheduled.status === 'completed' && (
                                <>
                                  <span className="text-primary">{scheduled.sent_count} enviadas</span>
                                  {scheduled.error_count > 0 && (
                                    <span className="text-destructive">{scheduled.error_count} falharam</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {scheduled.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-destructive hover:text-destructive"
                              onClick={() => handleCancelScheduled(scheduled.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Template</DialogTitle>
            <DialogDescription>
              Dê um nome para salvar esta mensagem como template reutilizável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do Template</Label>
              <Input
                id="template-name"
                placeholder="Ex: Lembrete de pagamento"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prévia da Mensagem</Label>
              <div className="p-3 rounded-lg bg-secondary/30 text-sm max-h-[150px] overflow-y-auto">
                {message}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {isSavingTemplate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Envio</DialogTitle>
            <DialogDescription>
              Escolha a data e hora para enviar automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-date">Data</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-time">Hora</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
              <p className="text-sm font-medium">Resumo do Agendamento</p>
              <p className="text-xs text-muted-foreground">
                {selectedRecipients.size} destinatários selecionados
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                Mensagem: {message.substring(0, 100)}{message.length > 100 ? '...' : ''}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleScheduleMessage} disabled={isScheduling}>
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agendando...
                </>
              ) : (
                'Agendar Envio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerar Mensagem com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o que você precisa e a IA criará uma mensagem personalizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-purpose">Propósito da mensagem *</Label>
              <Input
                id="ai-purpose"
                placeholder="Ex: lembrar sobre reunião de pais, avisar sobre aula cancelada..."
                value={aiPurpose}
                onChange={(e) => setAiPurpose(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-tone">Tom da mensagem</Label>
              <Select value={aiTone} onValueChange={setAiTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional e amigável">Profissional e Amigável</SelectItem>
                  <SelectItem value="formal e respeitoso">Formal e Respeitoso</SelectItem>
                  <SelectItem value="descontraído e caloroso">Descontraído e Caloroso</SelectItem>
                  <SelectItem value="urgente e direto">Urgente e Direto</SelectItem>
                  <SelectItem value="comemorativo e alegre">Comemorativo e Alegre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-context">Contexto adicional (opcional)</Label>
              <Textarea
                id="ai-context"
                placeholder="Ex: é uma mensagem para pais de alunos do curso de robótica, a reunião será dia 15..."
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">
                💡 A IA incluirá automaticamente as variáveis de personalização como {'{nome_responsavel}'} e {'{nome_aluno}'} quando apropriado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateWithAI} disabled={isGenerating || (!!aiCooldownUntil && Date.now() < aiCooldownUntil)} className="gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Gerar Mensagem
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
