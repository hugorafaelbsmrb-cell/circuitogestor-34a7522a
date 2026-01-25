import { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const categoryOptions = [
  { value: 'lead', label: 'Lead - Primeiro Contato' },
  { value: 'lead_followup', label: 'Lead - Acompanhamento' },
  { value: 'lead_scheduled', label: 'Lead - Agendamento' },
  { value: 'lead_reactivation', label: 'Lead - Reativação' },
  { value: 'general', label: 'Geral' },
];

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
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Filter states
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [selectAll, setSelectAll] = useState(true);
  
  // Message states
  const [selectedCategory, setSelectedCategory] = useState('lead');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Send states
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [isWapiConfigured, setIsWapiConfigured] = useState(false);

  // AI states
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState('profissional e amigável');
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Scheduling states
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  // Current tab
  const [activeTab, setActiveTab] = useState('compose');

  // Save as template states
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLeads();
      fetchTemplates();
      checkWapiConfig();
      setSendResults([]);
      setSendProgress(0);
      setSelectAll(true);
      setActiveTab('compose');
    }
  }, [open]);

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

  const recipients = selectAll ? filteredLeads : [];

  const filteredTemplates = templates.filter(t => t.category === selectedCategory);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getMessage = () => {
    return selectedTemplate?.message || customMessage;
  };

  const handleGenerateWithAI = async () => {
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
      const { data, error } = await supabase.functions.invoke('generate-message', {
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
        setActiveTab('compose');
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
      console.error('Error generating message:', error);
      toast({
        title: 'Erro ao gerar',
        description: error.message || 'Não foi possível gerar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleMessage = async () => {
    const message = getMessage();
    if (!message) {
      toast({
        title: 'Mensagem vazia',
        description: 'Digite uma mensagem ou gere com IA.',
        variant: 'destructive',
      });
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      toast({
        title: 'Data e hora obrigatórios',
        description: 'Selecione a data e hora do agendamento.',
        variant: 'destructive',
      });
      return;
    }

    if (recipients.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um lead para enviar.',
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
          course_filter: courseFilter,
          recipient_ids: recipients.map(r => r.id),
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Mensagem agendada',
        description: `Envio programado para ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
      });

      onOpenChange(false);
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

    if (recipients.length === 0) {
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
    
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Get course name for this lead
        const courseName = recipient.interested_course_id 
          ? courses.find(c => c.id === recipient.interested_course_id)?.name || ''
          : '';
        
        const personalizedMessage = message
          .replace(/{nome_responsavel}/g, recipient.name.split(' ')[0])
          .replace(/{nome_aluno}/g, recipient.student_name || recipient.name)
          .replace(/{nome_curso}/g, courseName);
        
        const success = await sendMessage({
          phone: recipient.phone,
          message: personalizedMessage,
        });
        
        results.push({ id: recipient.id, name: recipient.name, success });
        
        await supabase.from('message_logs').insert({
          lead_id: recipient.id,
          phone: recipient.phone,
          template_category: selectedTemplate?.category || 'general',
          message_preview: personalizedMessage.substring(0, 100),
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
      setSendProgress(((i + 1) / recipients.length) * 100);
      
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
      }
    }

    setIsSending(false);
    
    const successCount = results.filter(r => r.success).length;
    toast({
      title: 'Envio concluído',
      description: `${successCount} de ${recipients.length} mensagens enviadas com sucesso.`,
    });
  };

  const successCount = sendResults.filter(r => r.success).length;
  const errorCount = sendResults.filter(r => !r.success).length;

  const getCourseLeadCount = (courseId: string) => {
    if (courseId === 'all') return leads.length;
    if (courseId === 'none') return leads.filter(l => !l.interested_course_id).length;
    return leads.filter(l => l.interested_course_id === courseId).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Envio em Massa para Leads
          </DialogTitle>
          <DialogDescription>
            Envie mensagens WhatsApp para leads filtrados por curso de interesse
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh] pr-4">
          <div className="space-y-4 py-2">
            {/* Course Filter - always visible */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtrar por Curso de Interesse
              </Label>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todos os leads ({getCourseLeadCount('all')})
                  </SelectItem>
                  <SelectItem value="none">
                    Sem curso definido ({getCourseLeadCount('none')})
                  </SelectItem>
                  {courses.filter(c => c.is_active).map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} ({getCourseLeadCount(course.id)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipients summary - always visible */}
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isLoadingLeads ? 'Carregando...' : `${filteredLeads.length} leads selecionados`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="selectAll"
                  checked={selectAll}
                  onCheckedChange={(checked) => setSelectAll(checked === true)}
                />
                <Label htmlFor="selectAll" className="text-sm cursor-pointer">
                  Enviar para todos
                </Label>
              </div>
            </div>

            {/* Scheduling section - compact, visible early */}
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
              <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
              <Label className="text-sm font-medium whitespace-nowrap">Agendar:</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="h-8 w-36"
                placeholder="Data"
              />
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="h-8 w-28"
                placeholder="Hora"
              />
              {scheduleDate && scheduleTime && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ✓ Agendado
                </span>
              )}
            </div>

            {/* W-API warning */}
            {!isWapiConfigured && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-600">W-API não configurada</p>
                  <p className="text-muted-foreground">Configure a W-API nas configurações para enviar mensagens.</p>
                </div>
              </div>
            )}

            {/* Tabs for message composition method */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="compose" className="gap-2">
                  <Send className="w-4 h-4" />
                  Compor
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Gerar com IA
                </TabsTrigger>
              </TabsList>

              {/* Compose Tab */}
              <TabsContent value="compose" className="space-y-4 mt-4">
                {/* Template selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select 
                      value={selectedTemplateId} 
                      onValueChange={setSelectedTemplateId}
                      disabled={isLoadingTemplates}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Mensagem personalizada</SelectItem>
                        {filteredTemplates.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground italic">
                            Nenhum template nesta categoria
                          </div>
                        ) : (
                          filteredTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {filteredTemplates.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Crie templates na aba "Templates" da página de Leads
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom message or template preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{selectedTemplateId === 'custom' || !selectedTemplateId ? 'Mensagem' : 'Preview'}</Label>
                    {(selectedTemplateId === 'custom' || !selectedTemplateId) && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setCustomMessage(prev => prev + '{nome_responsavel}')}
                        >
                          +Nome
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setCustomMessage(prev => prev + '{nome_aluno}')}
                        >
                          +Aluno
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setCustomMessage(prev => prev + '{nome_curso}')}
                        >
                          +Curso
                        </Button>
                      </div>
                    )}
                  </div>
                  <Textarea
                    value={selectedTemplateId && selectedTemplateId !== 'custom' ? selectedTemplate?.message || '' : customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Digite sua mensagem ou use a IA para gerar..."
                    className="min-h-[100px]"
                    disabled={selectedTemplateId !== 'custom' && selectedTemplateId !== ''}
                  />

                  {/* Save as template section */}
                  {(selectedTemplateId === 'custom' || !selectedTemplateId) && customMessage.trim() && (
                    <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-2">
                      {!showSaveTemplate ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => setShowSaveTemplate(true)}
                        >
                          <Save className="w-4 h-4" />
                          Salvar como Template
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder="Nome do template..."
                              className="h-8"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!templateName.trim() || isSavingTemplate}
                              onClick={async () => {
                                setIsSavingTemplate(true);
                                const key = `whatsapp_template_${templateName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
                                const templateValue = JSON.stringify({
                                  name: templateName,
                                  category: selectedCategory,
                                  message: customMessage,
                                });
                                
                                const { error } = await supabase
                                  .from('app_settings')
                                  .insert({
                                    key,
                                    value: templateValue,
                                    description: `Template de mensagem: ${templateName}`,
                                  });
                                
                                if (error) {
                                  toast({
                                    title: 'Erro ao salvar template',
                                    description: error.message,
                                    variant: 'destructive',
                                  });
                                } else {
                                  toast({
                                    title: 'Template salvo!',
                                    description: 'O template foi salvo e está disponível para uso.',
                                  });
                                  fetchTemplates();
                                  setTemplateName('');
                                  setShowSaveTemplate(false);
                                }
                                setIsSavingTemplate(false);
                              }}
                              className="gap-1 h-8"
                            >
                              {isSavingTemplate ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              Salvar
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Será salvo na categoria: {categoryOptions.find(c => c.value === selectedCategory)?.label}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {'{nome_responsavel}'} = primeiro nome, {'{nome_aluno}'} = nome do aluno, {'{nome_curso}'} = curso de interesse
                  </p>
                </div>
              </TabsContent>

              {/* AI Generation Tab */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Gerar Mensagem com IA</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Descreva o propósito da mensagem e a IA criará um texto otimizado para WhatsApp.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aiPurpose">Propósito da Mensagem *</Label>
                  <Textarea
                    id="aiPurpose"
                    value={aiPurpose}
                    onChange={(e) => setAiPurpose(e.target.value)}
                    placeholder="Ex: Convidar para aula experimental, lembrar sobre matrícula, reativar lead inativo..."
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aiTone">Tom da Mensagem</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toneOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aiContext">Contexto Adicional (opcional)</Label>
                  <Textarea
                    id="aiContext"
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    placeholder="Ex: Promoção de 20% para matrículas até sexta, nova turma abrindo em março..."
                    className="min-h-[60px]"
                  />
                </div>

                <Button 
                  onClick={handleGenerateWithAI} 
                  disabled={isGenerating || !aiPurpose.trim()}
                  className="w-full gap-2"
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

                {/* Show generated message preview */}
                {customMessage && (
                  <div className="space-y-2">
                    <Label>Mensagem Gerada</Label>
                    <div className="p-3 bg-secondary/50 rounded-lg text-sm whitespace-pre-wrap">
                      {customMessage}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Message Preview - always visible when there's a message */}
            {getMessage() && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <Label className="text-xs text-muted-foreground">Mensagem atual</Label>
                <p className="text-sm whitespace-pre-wrap">{getMessage()}</p>
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
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending || isScheduling}>
            {sendResults.length > 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          
          {sendResults.length === 0 && (
            <>
              {/* Schedule button - only show when date/time is set */}
              {scheduleDate && scheduleTime && (
                <Button 
                  variant="secondary"
                  onClick={handleScheduleMessage}
                  disabled={isScheduling || !getMessage() || recipients.length === 0}
                  className="gap-2"
                >
                  {isScheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Agendando...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Agendar
                    </>
                  )}
                </Button>
              )}
              
              {/* Send now button */}
              <Button 
                onClick={handleSendViaWapi}
                disabled={isSending || !getMessage() || recipients.length === 0 || !isWapiConfigured}
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
                    Enviar Agora ({recipients.length})
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
