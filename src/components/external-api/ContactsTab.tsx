import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  MessageSquare, 
  Copy, 
  Check, 
  RefreshCw, 
  Send,
  ExternalLink,
  Settings2,
  Code
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ContactsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);

  // Fetch site contact leads
  const { data: siteLeads, isLoading, refetch } = useQuery({
    queryKey: ['site-contact-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          phone,
          notes,
          status,
          created_at,
          interested_course_id,
          courses:interested_course_id (name)
        `)
        .eq('source', 'site_contact_form')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch automation settings
  const { data: automationData } = useQuery({
    queryKey: ['site-contact-automation'],
    queryFn: async () => {
      const { data: automation } = await supabase
        .from('automation_settings')
        .select('enabled')
        .eq('key', 'auto_site_contact_welcome')
        .maybeSingle();
      
      const { data: template } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'whatsapp_template_site_contact')
        .maybeSingle();
      
      setIsAutomationEnabled(automation?.enabled ?? false);
      setMessageTemplate(template?.value || 'Olá {nome_responsavel}! 👋\n\nRecebemos sua mensagem através do nosso site.\n\nObrigado pelo interesse em {nome_curso}!\n\nEm breve nossa equipe entrará em contato.\n\nAbraços! 🚀');
      
      return { automation, template };
    },
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const endpointUrl = `${supabaseUrl}/functions/v1/site-contact-lead`;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopiedEndpoint(true);
    toast({ title: 'Endpoint copiado!' });
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleSaveTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'whatsapp_template_site_contact',
          value: messageTemplate,
          description: 'Template de mensagem para contatos do site',
        }, { onConflict: 'key' });
      
      toast({ title: 'Template salvo com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['site-contact-automation'] });
    } catch (error) {
      toast({ title: 'Erro ao salvar template', variant: 'destructive' });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleToggleAutomation = async (enabled: boolean) => {
    setIsSavingAutomation(true);
    try {
      await supabase
        .from('automation_settings')
        .upsert({
          key: 'auto_site_contact_welcome',
          enabled,
          description: 'Enviar mensagem automática para contatos do site',
        }, { onConflict: 'key' });
      
      setIsAutomationEnabled(enabled);
      toast({ 
        title: enabled ? 'Automação ativada!' : 'Automação desativada',
        description: enabled ? 'Novos contatos receberão mensagem automática' : ''
      });
      queryClient.invalidateQueries({ queryKey: ['site-contact-automation'] });
    } catch (error) {
      toast({ title: 'Erro ao alterar automação', variant: 'destructive' });
    } finally {
      setIsSavingAutomation(false);
    }
  };

  const examplePayload = JSON.stringify({
    name: "João Silva",
    phone: "11999998888",
    course_name: "Soroban",
    message: "Gostaria de mais informações sobre o curso"
  }, null, 2);

  return (
    <div className="space-y-6">
      {/* Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Endpoint para Formulário de Contato
          </CardTitle>
          <CardDescription>
            Configure seu formulário do site para enviar dados para este endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Endpoint (POST)</Label>
            <div className="flex gap-2">
              <Input 
                value={endpointUrl} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleCopyEndpoint}
              >
                {copiedEndpoint ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Exemplo de Payload (JSON)</Label>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
              {examplePayload}
            </pre>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">Campos Aceitos:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-muted px-1 rounded">name</code> - Nome do cliente (obrigatório)</li>
              <li><code className="bg-muted px-1 rounded">phone</code> - WhatsApp (obrigatório)</li>
              <li><code className="bg-muted px-1 rounded">course_name</code> - Nome do curso de interesse</li>
              <li><code className="bg-muted px-1 rounded">interested_course_id</code> - ID do curso (alternativa)</li>
              <li><code className="bg-muted px-1 rounded">message</code> - Mensagem adicional</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Mensagem Automática
          </CardTitle>
          <CardDescription>
            Configure a mensagem enviada automaticamente via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Ativar envio automático</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagem de boas-vindas ao receber contato
              </p>
            </div>
            <Switch
              checked={isAutomationEnabled}
              onCheckedChange={handleToggleAutomation}
              disabled={isSavingAutomation}
            />
          </div>

          <div className="space-y-2">
            <Label>Template da Mensagem</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={6}
              placeholder="Digite o template da mensagem..."
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code>{'{nome_responsavel}'}</code>, <code>{'{nome_curso}'}</code>, <code>{'{nome_escola}'}</code>
            </p>
          </div>

          <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
            {isSavingTemplate ? 'Salvando...' : 'Salvar Template'}
          </Button>
        </CardContent>
      </Card>

      {/* Leads List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Contatos Recebidos
              </CardTitle>
              <CardDescription>
                Leads capturados do formulário de contato do site
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : !siteLeads?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum contato recebido ainda</p>
              <p className="text-sm">Configure o endpoint no seu site para começar a receber leads</p>
            </div>
          ) : (
            <div className="space-y-4">
              {siteLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{lead.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {lead.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                        {lead.status === 'new' ? 'Novo' : lead.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a 
                          href={`https://wa.me/${lead.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Send className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  
                  {(lead.courses as any)?.name && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Interesse:</span>{' '}
                      <span className="font-medium">{(lead.courses as any).name}</span>
                    </p>
                  )}
                  
                  {lead.notes && (
                    <p className="text-sm bg-muted p-2 rounded">
                      "{lead.notes}"
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Recebido em {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
