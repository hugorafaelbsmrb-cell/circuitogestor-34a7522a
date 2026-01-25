import { useState, useEffect } from 'react';
import { 
  Zap, 
  MessageSquare, 
  CreditCard, 
  GraduationCap, 
  Cake, 
  BookOpen,
  Users,
  UserPlus,
  Loader2,
  Settings,
  Clock,
  Keyboard,
  Smile,
  CheckCheck,
  MousePointerClick,
  List,
  Link2,
  Image as ImageIcon,
  MapPin,
  Contact,
  Edit,
  Info,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AutomationSetting {
  id: string;
  key: string;
  enabled: boolean;
  config: Record<string, any>;
  description: string | null;
}

interface AutomationConfig {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'payments' | 'enrollment' | 'students' | 'bulk' | 'whatsapp_features';
  hasConfig?: boolean;
  configFields?: { key: string; label: string; type: 'time' | 'select'; options?: { value: string; label: string }[] }[];
  hasTemplate?: boolean;
  templateCategory?: string;
}

interface MessageTemplate {
  name: string;
  category: string;
  message: string;
  is_active: boolean;
}

const automationConfigs: AutomationConfig[] = [
  // Payment automations
  {
    key: 'auto_payment_confirmed',
    title: 'Confirmação de Pagamento',
    description: 'Envia mensagem automática quando um pagamento for confirmado',
    icon: CreditCard,
    category: 'payments',
  },
  {
    key: 'auto_payment_reminder_48h',
    title: 'Lembrete 48h Antes',
    description: 'Envia lembrete 48h antes do vencimento do boleto',
    icon: Clock,
    category: 'payments',
    hasConfig: true,
    configFields: [
      { key: 'send_time', label: 'Horário de envio', type: 'time' },
    ],
  },
  {
    key: 'auto_payment_overdue',
    title: 'Notificação de Atraso',
    description: 'Envia notificação quando boleto estiver atrasado',
    icon: CreditCard,
    category: 'payments',
    hasConfig: true,
    configFields: [
      { key: 'send_time', label: 'Horário de envio', type: 'time' },
    ],
  },
  // Enrollment automations
  {
    key: 'auto_enrollment_welcome',
    title: 'Boas-vindas Pós-Matrícula',
    description: 'Envia boas-vindas automática após finalizar matrícula',
    icon: GraduationCap,
    category: 'enrollment',
    hasTemplate: true,
    templateCategory: 'enrollment',
  },
  {
    key: 'auto_contract_signed_notify',
    title: 'Notificação de Contrato Assinado',
    description: 'Envia mensagem ao responsável após assinar o contrato digitalmente',
    icon: FileText,
    category: 'enrollment',
    hasTemplate: true,
    templateCategory: 'contract_signed',
  },
  // Student automations
  {
    key: 'auto_birthday_greeting',
    title: 'Parabéns de Aniversário',
    description: 'Envia parabéns no aniversário do aluno',
    icon: Cake,
    category: 'students',
    hasConfig: true,
    configFields: [
      { key: 'send_time', label: 'Horário de envio', type: 'time' },
    ],
    hasTemplate: true,
    templateCategory: 'birthday',
  },
  {
    key: 'auto_lms_alert',
    title: 'Alerta Pedagógico LMS',
    description: 'Alerta responsáveis sobre alunos atrasados no LMS',
    icon: BookOpen,
    category: 'students',
    hasConfig: true,
    configFields: [
      { key: 'frequency', label: 'Frequência', type: 'select', options: [
        { value: 'daily', label: 'Diário' },
        { value: 'weekly', label: 'Semanal' },
      ]},
      { key: 'send_day', label: 'Dia de envio', type: 'select', options: [
        { value: 'monday', label: 'Segunda-feira' },
        { value: 'tuesday', label: 'Terça-feira' },
        { value: 'wednesday', label: 'Quarta-feira' },
        { value: 'thursday', label: 'Quinta-feira' },
        { value: 'friday', label: 'Sexta-feira' },
      ]},
    ],
  },
  // Bulk messaging
  {
    key: 'bulk_leads_enabled',
    title: 'Envio em Massa para Leads',
    description: 'Habilita envio em massa na página de Leads',
    icon: UserPlus,
    category: 'bulk',
  },
  {
    key: 'bulk_guardians_enabled',
    title: 'Envio em Massa para Responsáveis',
    description: 'Habilita envio em massa na página de Responsáveis',
    icon: Users,
    category: 'bulk',
  },
  // WhatsApp PRO Features
  {
    key: 'wapi_feature_typing',
    title: 'Indicador de Digitação',
    description: 'Exibe "digitando..." antes de enviar mensagens automáticas',
    icon: Keyboard,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_reactions',
    title: 'Reações com Emojis',
    description: 'Permite reagir a mensagens recebidas',
    icon: Smile,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_mark_read',
    title: 'Marcar como Lido',
    description: 'Marca mensagens como lidas automaticamente',
    icon: CheckCheck,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_buttons',
    title: 'Botões de Resposta',
    description: 'Envia mensagens com até 3 botões de resposta rápida',
    icon: MousePointerClick,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_lists',
    title: 'Listas de Opções',
    description: 'Envia menus com até 10 opções para autoatendimento',
    icon: List,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_link_preview',
    title: 'Preview de Links',
    description: 'Envia links com pré-visualização automática',
    icon: Link2,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_stickers',
    title: 'Stickers',
    description: 'Permite envio de figurinhas',
    icon: ImageIcon,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_location',
    title: 'Localização',
    description: 'Permite compartilhar localização da escola',
    icon: MapPin,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_vcard',
    title: 'Compartilhar Contatos',
    description: 'Permite enviar cartões de contato (VCard)',
    icon: Contact,
    category: 'whatsapp_features',
  },
  {
    key: 'wapi_feature_groups',
    title: 'Gerenciamento de Grupos',
    description: 'Criar e gerenciar grupos de WhatsApp',
    icon: Users,
    category: 'whatsapp_features',
  },
];

const categoryLabels: Record<string, { title: string; icon: React.ElementType }> = {
  payments: { title: 'Pagamentos', icon: CreditCard },
  enrollment: { title: 'Matrículas', icon: GraduationCap },
  students: { title: 'Alunos', icon: Users },
  bulk: { title: 'Disparo em Massa', icon: MessageSquare },
  whatsapp_features: { title: 'Recursos WhatsApp PRO', icon: Zap },
};

export function AutomationControlPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configSetting, setConfigSetting] = useState<AutomationSetting | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  
  // Template editing state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState<string>('');
  const [templateMessage, setTemplateMessage] = useState<string>('');
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('automation_settings')
      .select('*')
      .order('key');
    
    if (error) {
      toast({
        title: 'Erro ao carregar automações',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSettings(data?.map(s => ({
        ...s,
        config: typeof s.config === 'string' ? JSON.parse(s.config) : (s.config || {}),
      })) || []);
    }
    setIsLoading(false);
  };

  const handleToggle = async (key: string, enabled: boolean) => {
    setSavingKey(key);
    
    const { error } = await supabase
      .from('automation_settings')
      .update({ enabled })
      .eq('key', key);
    
    if (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSettings(prev => prev.map(s => s.key === key ? { ...s, enabled } : s));
      toast({
        title: enabled ? 'Automação ativada' : 'Automação desativada',
        description: `${automationConfigs.find(c => c.key === key)?.title} foi ${enabled ? 'ativada' : 'desativada'}.`,
      });
    }
    
    setSavingKey(null);
  };

  const handleOpenConfig = (setting: AutomationSetting) => {
    setConfigSetting(setting);
    setConfigForm(setting.config || {});
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!configSetting) return;
    
    setSavingKey(configSetting.key);
    
    const { error } = await supabase
      .from('automation_settings')
      .update({ config: configForm })
      .eq('key', configSetting.key);
    
    if (error) {
      toast({
        title: 'Erro ao salvar configuração',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSettings(prev => prev.map(s => s.key === configSetting.key ? { ...s, config: configForm } : s));
      toast({
        title: 'Configuração salva',
        description: 'As configurações foram atualizadas.',
      });
      setShowConfigModal(false);
    }
    
    setSavingKey(null);
  };

  const handleOpenTemplate = async (config: AutomationConfig) => {
    if (!config.templateCategory) return;
    
    setTemplateCategory(config.templateCategory);
    setTemplateTitle(config.title);
    setShowTemplateModal(true);
    
    // Find the template in app_settings
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'whatsapp_template_%');
    
    if (data) {
      for (const item of data) {
        try {
          const parsed: MessageTemplate = JSON.parse(item.value || '{}');
          if (parsed.category === config.templateCategory) {
            setTemplateMessage(parsed.message || '');
            setTemplateKey(item.key);
            return;
          }
        } catch {}
      }
    }
    
    // Default message if not found
    setTemplateMessage('');
    setTemplateKey(null);
  };

  const handleSaveTemplate = async () => {
    if (!templateCategory) return;
    
    setIsSavingTemplate(true);
    
    const templateData: MessageTemplate = {
      name: templateTitle,
      category: templateCategory,
      message: templateMessage,
      is_active: true,
    };
    
    const key = templateKey || `whatsapp_template_${templateCategory}`;
    
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key,
        value: JSON.stringify(templateData),
        description: `Template de ${templateTitle}`,
        is_secret: false,
      }, { onConflict: 'key' });
    
    if (error) {
      toast({
        title: 'Erro ao salvar template',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Template salvo',
        description: 'A mensagem foi atualizada com sucesso.',
      });
      setShowTemplateModal(false);
    }
    
    setIsSavingTemplate(false);
  };

  const getSetting = (key: string): AutomationSetting | undefined => {
    return settings.find(s => s.key === key);
  };

  const getConfigDisplay = (setting: AutomationSetting, config: AutomationConfig) => {
    if (!config.hasConfig || !setting.config) return null;
    
    const displays: string[] = [];
    if (setting.config.send_time) displays.push(`Horário: ${setting.config.send_time}`);
    if (setting.config.frequency) displays.push(`Frequência: ${setting.config.frequency === 'weekly' ? 'Semanal' : 'Diário'}`);
    if (setting.config.send_day) {
      const dayLabels: Record<string, string> = {
        monday: 'Segunda',
        tuesday: 'Terça',
        wednesday: 'Quarta',
        thursday: 'Quinta',
        friday: 'Sexta',
      };
      displays.push(`Dia: ${dayLabels[setting.config.send_day] || setting.config.send_day}`);
    }
    
    return displays.length > 0 ? displays.join(' | ') : null;
  };

  const renderCategory = (category: 'payments' | 'enrollment' | 'students' | 'bulk' | 'whatsapp_features') => {
    const configs = automationConfigs.filter(c => c.category === category);
    const categoryInfo = categoryLabels[category];
    if (!categoryInfo) return null;
    
    const { title, icon: CategoryIcon } = categoryInfo;
    
    return (
      <div key={category} className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CategoryIcon className="w-4 h-4" />
          {title}
        </h3>
        <div className="space-y-2">
          {configs.map(config => {
            const setting = getSetting(config.key);
            const Icon = config.icon;
            const configDisplay = setting ? getConfigDisplay(setting, config) : null;
            
            return (
              <Card key={config.key} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${setting?.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`w-4 h-4 ${setting?.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{config.title}</p>
                          <Badge variant={setting?.enabled ? 'default' : 'secondary'} className="text-xs">
                            {setting?.enabled ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
                        {configDisplay && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{configDisplay}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.hasTemplate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenTemplate(config)}
                          className="h-8 w-8"
                          title="Editar mensagem"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {config.hasConfig && setting && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenConfig(setting)}
                          className="h-8 w-8"
                          title="Configurações"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                      <Switch
                        checked={setting?.enabled || false}
                        onCheckedChange={(checked) => handleToggle(config.key, checked)}
                        disabled={savingKey === config.key || !setting}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentConfig = configSetting ? automationConfigs.find(c => c.key === configSetting.key) : null;

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Automações de WhatsApp
          </CardTitle>
          <CardDescription>
            Gerencie os disparos automáticos de mensagens WhatsApp do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderCategory('payments')}
          {renderCategory('enrollment')}
          {renderCategory('students')}
          {renderCategory('bulk')}
          {renderCategory('whatsapp_features')}
        </CardContent>
      </Card>

      {/* Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar {currentConfig?.title}</DialogTitle>
            <DialogDescription>
              Ajuste as configurações desta automação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentConfig?.configFields?.map(field => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === 'time' ? (
                  <Input
                    id={field.key}
                    type="time"
                    value={configForm[field.key] || '09:00'}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                ) : field.type === 'select' && field.options ? (
                  <Select
                    value={configForm[field.key] || field.options[0]?.value}
                    onValueChange={(value) => setConfigForm(prev => ({ ...prev, [field.key]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig} disabled={savingKey !== null}>
              {savingKey ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Edit Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Editar Mensagem: {templateTitle}
            </DialogTitle>
            <DialogDescription>
              Personalize o texto da mensagem automática
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-message">Texto da Mensagem</Label>
              <Textarea
                id="template-message"
                value={templateMessage}
                onChange={(e) => setTemplateMessage(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Variáveis disponíveis:</p>
                  <ul className="space-y-0.5">
                    <li><code className="bg-muted px-1 rounded">{'{nome_responsavel}'}</code> - Nome do responsável</li>
                    <li><code className="bg-muted px-1 rounded">{'{nome_aluno}'}</code> - Nome do aluno</li>
                    <li><code className="bg-muted px-1 rounded">{'{nome_escola}'}</code> - Nome da escola</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {isSavingTemplate && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
