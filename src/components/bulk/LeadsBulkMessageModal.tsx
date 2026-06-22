import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  AlertCircle,
  Filter,
  Sparkles,
  Zap,
  Save,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Link2,
  Upload,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { useSchool } from '@/contexts/SchoolContext';
import { useAIProvider } from '@/hooks/useAIProvider';

interface Lead {
  id: string;
  name: string;
  phone: string;
  interested_course_id: string | null;
  student_name: string | null;
}

interface Template {
  id: string;
  name: string;
  category: string;
  message: string;
}

interface SendResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
}

interface LeadsBulkMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Removed categoryOptions - now using courses for template filtering

const toneOptions = [
  { value: 'profissional e amigável', label: 'Profissional e Amigável' },
  { value: 'formal e respeitoso', label: 'Formal e Respeitoso' },
  { value: 'casual e descontraído', label: 'Casual e Descontraído' },
  { value: 'urgente e direto', label: 'Urgente e Direto' },
];

const SEND_DELAY_MS = 3500;

export function LeadsBulkMessageModal({ 
  open, 
  onOpenChange,
}: LeadsBulkMessageModalProps) {
  const { toast } = useToast();
  const { courses } = useSchool();
  const { sendMessage, checkConfig } = useWapiMessage();
  const { getGenerateFunctionName } = useAIProvider();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Filter states
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Recipient selection
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  
  // Message states
  const [templateCourseFilter, setTemplateCourseFilter] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom');
  const [customMessage, setCustomMessage] = useState('');
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // AI states (inline, like Envio em Massa)
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
  
  // Send states
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [isWapiConfigured, setIsWapiConfigured] = useState(false);

  // Image + Link
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchLeads();
      fetchTemplates();
      checkWapiConfig();
      setSendResults([]);
      setSendProgress(0);
      setSelectedRecipients(new Set());
      setImageUrl('');
      setLinkUrl('');
    }
  }, [open]);

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

  const checkWapiConfig = async () => {
    const config = await checkConfig();
    setIsWapiConfigured(config.isConfigured);
  };

  const fetchLeads = async () => {
    setIsLoadingLeads(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, interested_course_id, student_name')
      .not('status', 'in', '("converted","lost")');
    
    if (!error && data) {
      setLeads(data);
    }
    setIsLoadingLeads(false);
  };

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .like('key', 'whatsapp_template_%');
    
    if (!error && data) {
      const parsed: Template[] = data.map(setting => {
        try {
          const p = JSON.parse(setting.value || '{}');
          return {
            id: setting.id,
            name: p.name || setting.key.replace('whatsapp_template_', ''),
            category: p.category || 'general',
            message: p.message || '',
          };
        } catch {
          return {
            id: setting.id,
            name: setting.key.replace('whatsapp_template_', ''),
            category: 'general',
            message: setting.value || '',
          };
        }
      });
      setTemplates(parsed);
    }
    setIsLoadingTemplates(false);
  };

  const filteredLeads = useMemo(() => {
    if (courseFilter === 'all') return leads;
    if (courseFilter === 'none') return leads.filter(l => !l.interested_course_id);
    return leads.filter(l => l.interested_course_id === courseFilter);
  }, [leads, courseFilter]);

  // Default: keep everyone selected for current filter
  useEffect(() => {
    if (!open) return;
    setSelectedRecipients(new Set(filteredLeads.map(l => l.id)));
  }, [open, filteredLeads]);

  const recipientsToSend = useMemo(
    () => filteredLeads.filter(l => selectedRecipients.has(l.id)),
    [filteredLeads, selectedRecipients]
  );

  const filteredTemplates = useMemo(() => {
    if (templateCourseFilter === 'all') return templates;
    return templates.filter(t => t.category === templateCourseFilter);
  }, [templates, templateCourseFilter]);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getMessage = () => {
    return selectedTemplate?.message || customMessage;
  };

  const getCourseLeadCount = (courseId: string) => {
    if (courseId === 'all') return leads.length;
    if (courseId === 'none') return leads.filter(l => !l.interested_course_id).length;
    return leads.filter(l => l.interested_course_id === courseId).length;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecipients(new Set(filteredLeads.map(l => l.id)));
    } else {
      setSelectedRecipients(new Set());
    }
  };

  const handleSelectRecipient = (id: string, checked: boolean) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('lead-bulk-message') as HTMLTextAreaElement | null;
    const baseMessage = (selectedTemplateId && selectedTemplateId !== 'custom')
      ? (selectedTemplate?.message || '')
      : (customMessage || '');

    // If a template is selected, switch to custom and append variable (cursor insertion isn't reliable on a disabled textarea)
    if (selectedTemplateId && selectedTemplateId !== 'custom') {
      setSelectedTemplateId('custom');
      setCustomMessage(baseMessage + variable);
      return;
    }

    if (!textarea) {
      setCustomMessage(baseMessage + variable);
      setSelectedTemplateId('custom');
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = baseMessage.substring(0, start) + variable + baseMessage.substring(end);
    setCustomMessage(next);
    setSelectedTemplateId('custom');
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

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
          context: aiContext || 'mensagem para leads interessados em cursos',
        },
      });

      if (error) throw error;

      if (data?.message) {
        setCustomMessage(data.message);
        setSelectedTemplateId('custom');
        setAiPurpose('');
        setAiContext('');
        toast({
          title: 'Mensagem gerada',
          description: 'A IA criou uma mensagem. Revise e edite se necessário.',
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

        // Fallback automático para o provedor interno
        try {
          const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke(
            'generate-message',
            {
              body: {
                purpose: aiPurpose,
                tone: aiTone,
                context: aiContext || 'mensagem para leads interessados em cursos',
              },
            }
          );

          if (fallbackError) throw fallbackError;

          if (fallbackData?.message) {
            setCustomMessage(fallbackData.message);
            setSelectedTemplateId('custom');
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
        description: parsed.body?.error || error?.message || 'Não foi possível gerar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || !customMessage.trim()) return;
    
    setIsSavingTemplate(true);
    try {
      const templateKey = `whatsapp_template_lead_${Date.now()}`;
      const templateValue = JSON.stringify({
        name: newTemplateName.trim(),
        category: templateCourseFilter !== 'all' ? templateCourseFilter : 'lead',
        message: customMessage,
      });

      const { error } = await supabase
        .from('app_settings')
        .insert({
          key: templateKey,
          value: templateValue,
          description: `Template de leads: ${newTemplateName.trim()}`,
        });

      if (error) throw error;

      toast({
        title: 'Template salvo',
        description: `O template "${newTemplateName}" foi salvo com sucesso.`,
      });

      setNewTemplateName('');
      setIsSavingTemplate(false);
      fetchTemplates(); // Refresh templates list
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Não foi possível salvar o template.',
        variant: 'destructive',
      });
      setIsSavingTemplate(false);
    }
  };

  const handleSendViaWapi = async () => {
    const message = getMessage();
    if (!message) {
      toast({
        title: 'Mensagem vazia',
        description: 'Selecione um template ou digite uma mensagem.',
        variant: 'destructive',
      });
      return;
    }

    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um lead para enviar.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setSendResults([]);

    const results: SendResult[] = [];
    
    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];
      
      try {
        const courseName = recipient.interested_course_id 
          ? courses.find(c => c.id === recipient.interested_course_id)?.name || ''
          : '';
        
        let personalizedMessage = message
          .replace(/{nome_responsavel}/g, recipient.name.split(' ')[0])
          .replace(/{nome_aluno}/g, recipient.student_name || recipient.name)
          .replace(/{nome_curso}/g, courseName);

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

        results.push({ id: recipient.id, name: recipient.name, success });

        await supabase.from('message_logs').insert({
          lead_id: recipient.id,
          phone: recipient.phone,
          template_category: selectedTemplate?.category || 'general',
          message_preview: (imageUrl ? '[IMG] ' : '') + personalizedMessage.substring(0, 100),
          automation_key: 'bulk_leads',
          status: success ? 'sent' : 'error',
          error_message: success ? null : 'Falha no envio',
        });
        
      } catch (error) {
        results.push({ 
          id: recipient.id, 
          name: recipient.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        });
      }
      
      setSendResults([...results]);
      setSendProgress(((i + 1) / recipientsToSend.length) * 100);
      
      if (i < recipientsToSend.length - 1) {
        await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
      }
    }

    setIsSending(false);
    
    const successCount = results.filter(r => r.success).length;
    toast({
      title: 'Envio concluído',
      description: `${successCount} de ${recipientsToSend.length} mensagens enviadas com sucesso.`,
    });
  };

  const handleSendViaWeb = () => {
    const message = getMessage();
    if (!message) {
      toast({
        title: 'Mensagem vazia',
        description: 'Selecione um template ou digite uma mensagem.',
        variant: 'destructive',
      });
      return;
    }

    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um lead para enviar.',
        variant: 'destructive',
      });
      return;
    }

    recipientsToSend.forEach((recipient, index) => {
      const courseName = recipient.interested_course_id 
        ? courses.find(c => c.id === recipient.interested_course_id)?.name || ''
        : '';
      
      const personalizedMessage = message
        .replace(/{nome_responsavel}/g, recipient.name.split(' ')[0])
        .replace(/{nome_aluno}/g, recipient.student_name || recipient.name)
        .replace(/{nome_curso}/g, courseName);
      
      const cleanPhone = recipient.phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      const encodedMessage = encodeURIComponent(personalizedMessage);
      
      setTimeout(() => {
        window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
      }, index * 500);
    });

    toast({
      title: 'Abas abertas',
      description: `${recipientsToSend.length} abas do WhatsApp Web foram abertas.`,
    });
    
    onOpenChange(false);
  };

  const successCount = sendResults.filter(r => r.success).length;
  const errorCount = sendResults.filter(r => !r.success).length;

  const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedRecipients.has(l.id));
  const someSelected = filteredLeads.some(l => selectedRecipients.has(l.id)) && !allSelected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Envio em Massa - Leads
          </DialogTitle>
          <DialogDescription>
            Envie mensagens WhatsApp para múltiplos leads de uma vez
          </DialogDescription>
        </DialogHeader>

        {/* Scroll do conteúdo inteiro do modal (entre header e footer) */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="py-4 pr-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Message Composer */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Compor Mensagem
                </CardTitle>
                <CardDescription>
                  Clique nas variáveis para inserir na mensagem
                </CardDescription>
              </CardHeader>

                <CardContent className="space-y-4">
                {/* W-API warning */}
                {!isWapiConfigured && (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-warning">W-API não configurada</p>
                      <p className="text-muted-foreground">O envio será feito via WhatsApp Web (abrirá abas no navegador).</p>
                    </div>
                  </div>
                )}


                {/* Template selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Curso (filtrar templates)</Label>
                    <Select value={templateCourseFilter} onValueChange={setTemplateCourseFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os templates</SelectItem>
                        {courses.filter(c => c.is_active).map(course => (
                          <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                        ))}
                        <SelectItem value="report_notification">Notificação de Relatório</SelectItem>
                        <SelectItem value="portal_announcement">Anúncio do Portal</SelectItem>
                        <SelectItem value="general">Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Template (opcional)</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                      disabled={isLoadingTemplates}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escreva sua própria mensagem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Escrever mensagem</SelectItem>
                        {filteredTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Clickable Variables */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Variáveis de personalização</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { variable: '{nome_responsavel}', label: 'Nome Responsável', description: 'Primeiro nome do responsável' },
                      { variable: '{nome_aluno}', label: 'Nome Aluno', description: 'Nome do aluno (se informado)' },
                      { variable: '{nome_curso}', label: 'Curso', description: 'Curso de interesse do lead' },
                    ].map((item) => (
                      <Button
                        key={item.variable}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(item.variable)}
                        disabled={isSending}
                        className="text-xs h-7 px-2 gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                        title={item.description}
                      >
                        <Zap className="w-3 h-3" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* AI Generator (collapsible) */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAiGenerator(!showAiGenerator)}
                    className="w-full p-3 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Gerar com IA (opcional)</p>
                        <p className="text-xs text-muted-foreground">Descreva o objetivo e a IA cria a mensagem</p>
                      </div>
                    </div>
                    {showAiGenerator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {showAiGenerator && (
                    <div className="p-3 space-y-3 bg-secondary/10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Propósito *</Label>
                          <Input
                            value={aiPurpose}
                            onChange={(e) => setAiPurpose(e.target.value)}
                            placeholder="Ex: convidar para uma visita"
                            disabled={isGenerating || isSending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tom</Label>
                          <Select value={aiTone} onValueChange={setAiTone}>
                            <SelectTrigger disabled={isGenerating || isSending}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {toneOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Contexto (opcional)</Label>
                        <Textarea
                          value={aiContext}
                          onChange={(e) => setAiContext(e.target.value)}
                          placeholder="Ex: lead pediu informações sobre valores e horários"
                          rows={2}
                          disabled={isGenerating || isSending}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleGenerateWithAI}
                          disabled={isGenerating || isSending || !aiPurpose.trim() || (!!aiCooldownUntil && Date.now() < aiCooldownUntil)}
                        className="gap-2"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Gerar Mensagem
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Mensagem</Label>
                    {customMessage.trim() && selectedTemplateId === 'custom' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSavingTemplate(true)}
                        disabled={isSending || isSavingTemplate}
                        className="h-7 text-xs gap-1"
                      >
                        <Save className="w-3 h-3" />
                        Salvar como Template
                      </Button>
                    )}
                  </div>
                  <Textarea
                    id="lead-bulk-message"
                    value={selectedTemplateId && selectedTemplateId !== 'custom' ? selectedTemplate?.message || '' : customMessage}
                    onChange={(e) => {
                      if (selectedTemplateId !== 'custom') {
                        setSelectedTemplateId('custom');
                      }
                      setCustomMessage(e.target.value);
                    }}
                    placeholder="Olá {nome_responsavel}, escreva sua mensagem aqui..."
                    className="min-h-[150px] resize-none"
                    disabled={isSending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use as variáveis acima para personalizar. A mensagem será adaptada para cada lead.
                  </p>
                </div>

                {/* Save as Template dialog */}
                {isSavingTemplate && (
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Salvar como Template</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do template</Label>
                      <Input
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Ex: Convite para visita"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveAsTemplate}
                        disabled={!newTemplateName.trim()}
                        className="gap-1"
                      >
                        <Save className="w-3 h-3" />
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsSavingTemplate(false);
                          setNewTemplateName('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Progress and results */}
                {(isSending || sendResults.length > 0) && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progresso</span>
                        <span>{Math.round(sendProgress)}%</span>
                      </div>
                      <Progress value={sendProgress} />
                    </div>

                    {sendResults.length > 0 && (
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle className="w-4 h-4" />
                          {successCount} enviados
                        </div>
                        {errorCount > 0 && (
                          <div className="flex items-center gap-1 text-destructive">
                            <XCircle className="w-4 h-4" />
                            {errorCount} erros
                          </div>
                        )}
                      </div>
                    )}

                    {errorCount > 0 && (
                      <ScrollArea className="h-[100px] border rounded-md p-2">
                        <div className="space-y-1">
                          {sendResults.filter(r => !r.success).map(r => (
                            <div key={r.id} className="text-xs text-destructive">
                              {r.name}: {r.error || 'Falha no envio'}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recipients Selection */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Destinatários
                </CardTitle>
                <CardDescription>
                  Filtre e selecione os leads para enviar
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Filter by Course */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtrar por Curso de Interesse
                  </Label>
                  <Select
                    value={courseFilter}
                    onValueChange={(value) => {
                      setCourseFilter(value);
                      setSendResults([]);
                      setSendProgress(0);
                    }}
                    disabled={isSending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os leads ({getCourseLeadCount('all')})</SelectItem>
                      <SelectItem value="none">Sem curso definido ({getCourseLeadCount('none')})</SelectItem>
                      {courses.filter(c => c.is_active).map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name} ({getCourseLeadCount(course.id)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select All */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-leads"
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked === true)}
                      disabled={isSending}
                      className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                    />
                    <Label htmlFor="select-all-leads" className="text-sm font-medium cursor-pointer">
                      {isLoadingLeads ? 'Carregando...' : `Selecionar todos (${filteredLeads.length})`}
                    </Label>
                  </div>
                  <Badge variant="secondary">{selectedRecipients.size} selecionados</Badge>
                </div>

                {/* Leads List */}
                <ScrollArea className="h-[40vh] rounded-lg border">
                  <div className="p-2 space-y-1">
                    {filteredLeads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <p className="text-sm">Nenhum lead encontrado</p>
                      </div>
                    ) : (
                      filteredLeads.map((lead) => {
                        const result = sendResults.find(r => r.id === lead.id);
                        const isSelected = selectedRecipients.has(lead.id);
                        const courseName = lead.interested_course_id
                          ? courses.find(c => c.id === lead.interested_course_id)?.name
                          : null;

                        return (
                          <div
                            key={lead.id}
                            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors ${
                              result?.success ? 'bg-primary/10' :
                              result?.success === false ? 'bg-destructive/10' :
                              ''
                            }`}
                          >
                            <Checkbox
                              id={`lead-${lead.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectRecipient(lead.id, checked === true)}
                              disabled={isSending}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lead.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{lead.phone}</p>
                              {courseName && (
                                <p className="text-xs text-muted-foreground truncate">Interesse: {courseName}</p>
                              )}
                            </div>
                            {result && (
                              result.success ? (
                                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
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
              </CardContent>
            </Card>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            {sendResults.length > 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          {sendResults.length === 0 && (
            <Button 
              onClick={isWapiConfigured ? handleSendViaWapi : handleSendViaWeb}
              disabled={isSending || (!getMessage()) || selectedRecipients.size === 0}
              className="gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar para {selectedRecipients.size}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
