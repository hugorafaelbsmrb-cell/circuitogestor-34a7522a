import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  AlertCircle,
  Image as ImageIcon,
  Link2,
  Upload,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface Recipient {
  id: string;
  name: string;
  phone: string;
  type: 'guardian' | 'lead';
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

interface BulkMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Recipient[];
  defaultCategory?: string;
}

const categoryOptions = [
  { value: 'lead', label: 'Lead - Primeiro Contato' },
  { value: 'lead_followup', label: 'Lead - Acompanhamento' },
  { value: 'lead_scheduled', label: 'Lead - Agendamento' },
  { value: 'lead_reactivation', label: 'Lead - Reativação' },
  { value: 'enrollment', label: 'Matrícula' },
  { value: 'payment_reminder', label: 'Lembrete de Pagamento' },
  { value: 'report_notification', label: 'Notificação de Relatório' },
  { value: 'portal_announcement', label: 'Anúncio do Portal' },
  { value: 'general', label: 'Geral' },
];

const SEND_DELAY_MS = 3500; // 3.5 seconds between messages to avoid rate limiting

export function BulkMessageModal({ 
  open, 
  onOpenChange, 
  recipients, 
  defaultCategory = 'general' 
}: BulkMessageModalProps) {
  const { toast } = useToast();
  const { sendMessage, checkConfig } = useWapiMessage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [isWapiConfigured, setIsWapiConfigured] = useState(false);
  const [sendMode, setSendMode] = useState<'wapi' | 'web'>('wapi');

  useEffect(() => {
    if (open) {
      fetchTemplates();
      checkWapiConfig();
      setSendResults([]);
      setSendProgress(0);
    }
  }, [open]);

  const checkWapiConfig = async () => {
    const config = await checkConfig();
    setIsWapiConfigured(config.isConfigured);
    if (!config.isConfigured) {
      setSendMode('web');
    }
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

  const filteredTemplates = templates.filter(t => t.category === selectedCategory);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getMessage = () => {
    return selectedTemplate?.message || customMessage;
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

    setIsSending(true);
    setSendProgress(0);
    setSendResults([]);

    const results: SendResult[] = [];
    
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Replace variables in message
        const personalizedMessage = message
          .replace(/{nome_responsavel}/g, recipient.name)
          .replace(/{nome_aluno}/g, recipient.name);
        
        const success = await sendMessage({
          phone: recipient.phone,
          message: personalizedMessage,
        });
        
        results.push({ id: recipient.id, name: recipient.name, success });
        
        // Log the message
        await supabase.from('message_logs').insert({
          [recipient.type === 'guardian' ? 'guardian_id' : 'lead_id']: recipient.id,
          phone: recipient.phone,
          template_category: selectedTemplate?.category || 'general',
          message_preview: personalizedMessage.substring(0, 100),
          automation_key: 'bulk',
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
      
      // Wait between sends to avoid rate limiting
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

    // Open WhatsApp Web for each recipient
    recipients.forEach((recipient, index) => {
      const personalizedMessage = message
        .replace(/{nome_responsavel}/g, recipient.name)
        .replace(/{nome_aluno}/g, recipient.name);
      
      const cleanPhone = recipient.phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      const encodedMessage = encodeURIComponent(personalizedMessage);
      
      setTimeout(() => {
        window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
      }, index * 500); // Delay between opening tabs
    });

    toast({
      title: 'Abas abertas',
      description: `${recipients.length} abas do WhatsApp Web foram abertas.`,
    });
    
    onOpenChange(false);
  };

  const successCount = sendResults.filter(r => r.success).length;
  const errorCount = sendResults.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Envio em Massa - {recipients.length} destinatários
          </DialogTitle>
          <DialogDescription>
            Envie mensagens WhatsApp para múltiplos contatos de uma vez
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Recipients summary */}
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              {recipients.length} {recipients[0]?.type === 'lead' ? 'leads' : 'responsáveis'} selecionados
            </span>
          </div>

          {/* W-API warning */}
          {!isWapiConfigured && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-600">W-API não configurada</p>
                <p className="text-muted-foreground">O envio será feito via WhatsApp Web (abrirá abas no navegador).</p>
              </div>
            </div>
          )}

          {/* Send mode selection */}
          {isWapiConfigured && (
            <div className="space-y-2">
              <Label>Modo de envio</Label>
              <Select value={sendMode} onValueChange={(v) => setSendMode(v as 'wapi' | 'web')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wapi">Via W-API (automático)</SelectItem>
                  <SelectItem value="web">Via WhatsApp Web (manual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
                  {filteredTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom message or template preview */}
          <div className="space-y-2">
            <Label>{selectedTemplateId === 'custom' || !selectedTemplateId ? 'Mensagem' : 'Preview'}</Label>
            <Textarea
              value={selectedTemplateId && selectedTemplateId !== 'custom' ? selectedTemplate?.message || '' : customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="min-h-[100px]"
              disabled={selectedTemplateId !== 'custom' && selectedTemplateId !== ''}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {'{nome_responsavel}'}, {'{nome_aluno}'}
            </p>
          </div>

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            {sendResults.length > 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          {sendResults.length === 0 && (
            <Button 
              onClick={sendMode === 'wapi' && isWapiConfigured ? handleSendViaWapi : handleSendViaWeb}
              disabled={isSending || (!getMessage())}
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
                  Enviar para {recipients.length}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}