import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Key, 
  Save, 
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  Plus,
  Trash2,
  Percent,
  CreditCard,
  Webhook,
  Copy,
  CheckCircle,
  Upload,
  Building2,
  Zap,
  MessageSquare as MessageSquareIcon,
  DollarSign,
  MessageCircle,
  FileText,
  Mail
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { WapiConfigCard } from '@/components/settings/WapiConfigCard';
import { AutomationControlPanel } from '@/components/settings/AutomationControlPanel';
import { MessageLogsViewer } from '@/components/settings/MessageLogsViewer';
import { QuickRepliesConfigCard } from '@/components/settings/QuickRepliesConfigCard';
import { AIProviderConfigCard } from '@/components/settings/AIProviderConfigCard';
import { SystemDocumentation } from '@/components/settings/SystemDocumentation';
import { CanteenMessageConfigCard } from '@/components/settings/CanteenMessageConfigCard';
import { ReportNotificationConfigCard } from '@/components/settings/ReportNotificationConfigCard';
import { DropboxConfigCard } from '@/components/settings/DropboxConfigCard';
import { EmailConfigCard } from '@/components/settings/EmailConfigCard';
import { cn } from '@/lib/utils';
import '@/styles/print.css';

interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

interface SettingsSection {
  id: string;
  label: string;
  icon: typeof SettingsIcon;
  description: string;
}

const settingsSections: SettingsSection[] = [
  { id: 'branding', label: 'Identidade', icon: Building2, description: 'Nome, logo e favicon' },
  { id: 'ai', label: 'Inteligência Artificial', icon: Zap, description: 'Provedor de IA' },
  { id: 'api', label: 'APIs', icon: Key, description: 'Chaves de integração' },
  { id: 'email', label: 'E-mail', icon: Mail, description: 'Configuração IMAP/SMTP' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, description: 'Configuração W-API' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, description: 'URLs de notificação' },
  { id: 'financial', label: 'Financeiro', icon: DollarSign, description: 'Juros, multas e descontos' },
  { id: 'other', label: 'Outras', icon: SettingsIcon, description: 'Configurações gerais' },
  { id: 'docs', label: 'Documentação', icon: FileText, description: 'Manual do sistema' },
];

export default function Settings() {
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const { branding, updateBranding } = useSystemBranding();
  const { isAuthorized, isLoading: guardLoading } = useAdminGuard();
  
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeSection, setActiveSection] = useState('branding');
  const [newSetting, setNewSetting] = useState({
    key: '',
    value: '',
    description: '',
    is_secret: false,
  });
  
  // Branding state
  const [systemName, setSystemName] = useState('');
  const [browserTitle, setBrowserTitle] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  useEffect(() => {
    if (branding.name) {
      setSystemName(branding.name);
    }
    if (branding.browserTitle) {
      setBrowserTitle(branding.browserTitle);
    }
  }, [branding.name, branding.browserTitle]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('key');
    
    if (error) {
      toast({
        title: 'Erro ao carregar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSettings(data || []);
      const initial: Record<string, string> = {};
      data?.forEach(s => {
        initial[s.key] = s.value || '';
      });
      setEditedSettings(initial);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Update existing settings
      for (const setting of settings) {
        if (editedSettings[setting.key] !== (setting.value || '')) {
          const { error } = await supabase
            .from('app_settings')
            .update({ value: editedSettings[setting.key] || null })
            .eq('id', setting.id);
          
          if (error) throw error;
        }
      }
      
      // Create ASAAS_WEBHOOK_SECRET if it doesn't exist but has a value
      const webhookSecretExists = settings.some(s => s.key === 'ASAAS_WEBHOOK_SECRET');
      if (!webhookSecretExists && editedSettings['ASAAS_WEBHOOK_SECRET']) {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: 'ASAAS_WEBHOOK_SECRET',
            value: editedSettings['ASAAS_WEBHOOK_SECRET'],
            description: 'Token de autenticação para o webhook do Asaas',
            is_secret: true,
          });
        
        if (error && !error.message.includes('duplicate key')) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'As configurações foram atualizadas com sucesso.',
      });
      fetchSettings();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
    
    setIsSaving(false);
  };

  const handleAddSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSetting.key) {
      toast({
        title: 'Campo obrigatório',
        description: 'A chave é obrigatória.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('app_settings')
      .insert({
        key: newSetting.key.toUpperCase().replace(/\s+/g, '_'),
        value: newSetting.value || null,
        description: newSetting.description || null,
        is_secret: newSetting.is_secret,
      });

    if (error) {
      if (error.message.includes('duplicate key')) {
        toast({
          title: 'Chave já existe',
          description: 'Uma configuração com esta chave já existe.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao criar configuração',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Configuração criada',
        description: 'A nova configuração foi adicionada.',
      });
      setShowAddModal(false);
      setNewSetting({ key: '', value: '', description: '', is_secret: false });
      fetchSettings();
    }
  };

  const handleDeleteSetting = async (id: string, key: string) => {
    if (!confirm(`Tem certeza que deseja excluir a configuração "${key}"?`)) return;

    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Configuração excluída',
        description: 'A configuração foi removida.',
      });
      fetchSettings();
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `system-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('system-branding')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('system-branding')
        .getPublicUrl(fileName);

      await updateBranding({ logo: publicUrl });

      toast({
        title: 'Logo atualizado',
        description: 'O logo do sistema foi atualizado com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar logo',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsUploadingLogo(false);
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    
    try {
      await updateBranding({ name: systemName, browserTitle: browserTitle || systemName });
      toast({
        title: 'Configurações atualizadas',
        description: 'O nome e título do sistema foram atualizados com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setIsSavingBranding(false);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 500 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O favicon deve ter no máximo 500KB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingFavicon(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `favicon-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('system-branding')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('system-branding')
        .getPublicUrl(fileName);

      await updateBranding({ favicon: publicUrl });

      toast({
        title: 'Favicon atualizado',
        description: 'O favicon do sistema foi atualizado com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar favicon',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsUploadingFavicon(false);
  };

  const handleRemoveFavicon = async () => {
    setIsUploadingFavicon(true);
    
    try {
      await updateBranding({ favicon: null });
      toast({
        title: 'Favicon removido',
        description: 'O favicon do sistema foi removido.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setIsUploadingFavicon(false);
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    
    try {
      await updateBranding({ logo: null });
      toast({
        title: 'Logo removido',
        description: 'O logo do sistema foi removido.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setIsUploadingLogo(false);
  };

  const hasChanges = settings.some(s => editedSettings[s.key] !== (s.value || ''));

  // Group settings
  const apiSettings = settings.filter(s => s.key.includes('API') || s.key.includes('KEY'));
  const asaasDiscountSettings = settings.filter(s => s.key.startsWith('asaas_discount'));
  
  const otherSettings = settings.filter(s => 
    !s.key.includes('API') && 
    !s.key.includes('KEY') && 
    !s.key.startsWith('asaas_discount') &&
    !s.key.startsWith('asaas_interest') &&
    !s.key.startsWith('asaas_fine') &&
    !s.key.startsWith('login_') &&
    !s.key.startsWith('W_API')
  );

  // Check if guard is still loading or user is not authorized
  if (guardLoading || !isAuthorized) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'branding':
        return (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Identidade do Sistema
              </CardTitle>
              <CardDescription>
                Personalize o nome, logo, favicon e título do navegador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="system-name" className="font-medium">
                    Nome do Sistema
                  </Label>
                  <Input
                    id="system-name"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    placeholder="EduGestor"
                  />
                  <p className="text-xs text-muted-foreground">
                    Exibido na barra lateral e tela de login
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="browser-title" className="font-medium">
                    Título na Aba do Navegador
                  </Label>
                  <Input
                    id="browser-title"
                    value={browserTitle}
                    onChange={(e) => setBrowserTitle(e.target.value)}
                    placeholder={systemName || 'EduGestor'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Texto exibido na aba do navegador
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveBranding} 
                  disabled={isSavingBranding || (systemName === branding.name && browserTitle === (branding.browserTitle || ''))}
                >
                  {isSavingBranding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Nome e Título
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                <div className="space-y-2">
                  <Label className="font-medium">Logo do Sistema</Label>
                  <div className="flex items-center gap-4">
                    {branding.logo ? (
                      <div className="relative">
                        <img 
                          src={branding.logo} 
                          alt="Logo do sistema" 
                          className="w-16 h-16 object-contain rounded-lg border border-border bg-background"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        disabled={isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Enviar Logo
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG ou JPG, máximo 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">Favicon (Ícone da Aba)</Label>
                  <div className="flex items-center gap-4">
                    {branding.favicon ? (
                      <div className="relative">
                        <img 
                          src={branding.favicon} 
                          alt="Favicon do sistema" 
                          className="w-12 h-12 object-contain rounded-lg border border-border bg-background"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={handleRemoveFavicon}
                          disabled={isUploadingFavicon}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        id="favicon-upload"
                        accept="image/png,image/x-icon,image/svg+xml"
                        className="hidden"
                        onChange={handleFaviconUpload}
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('favicon-upload')?.click()}
                        disabled={isUploadingFavicon}
                      >
                        {isUploadingFavicon ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Enviar Favicon
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, ICO ou SVG, máximo 500KB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'ai':
        return <AIProviderConfigCard />;

      case 'api':
        return (
          <div className="space-y-6">
            <DropboxConfigCard />
            
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Outras Chaves de API
                </CardTitle>
                <CardDescription>
                  Configure chaves de API para outras integrações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {apiSettings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma chave de API configurada
                  </p>
                ) : (
                  apiSettings.map((setting) => (
                    <div key={setting.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={setting.key} className="font-medium">
                            {setting.key}
                          </Label>
                          {setting.is_secret && (
                            <Badge variant="outline" className="text-xs">
                              <Key className="w-3 h-3 mr-1" />
                              Secreto
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSetting(setting.id, setting.key)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {setting.description && (
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      )}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id={setting.key}
                            type={setting.is_secret && !showSecrets[setting.key] ? 'password' : 'text'}
                            value={editedSettings[setting.key] || ''}
                            onChange={(e) => setEditedSettings(prev => ({ ...prev, [setting.key]: e.target.value }))}
                            placeholder={setting.is_secret ? '••••••••••••••••' : 'Valor'}
                          />
                        </div>
                        {setting.is_secret && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => toggleShowSecret(setting.key)}
                          >
                            {showSecrets[setting.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {editedSettings[setting.key] !== (setting.value || '') && (
                        <p className="text-xs text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Alteração não salva
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'email':
        return <EmailConfigCard />;

      case 'whatsapp':
        return (
          <div className="space-y-6">
            <WapiConfigCard 
              editedSettings={editedSettings} 
              setEditedSettings={setEditedSettings} 
            />
            <QuickRepliesConfigCard />
            <CanteenMessageConfigCard />
            <ReportNotificationConfigCard />
          </div>
        );

      case 'webhooks':
        const webhookSecret = settings.find(s => s.key === 'ASAAS_WEBHOOK_SECRET');
        const webhookSecretValue = editedSettings['ASAAS_WEBHOOK_SECRET'] || '';
        const isSecretConfigured = webhookSecretValue && webhookSecretValue.length > 0;
        
        return (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Webhook de Pagamentos (Asaas)
              </CardTitle>
              <CardDescription>
                Configure esta URL e token de segurança no painel do Asaas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* URL Section */}
              <div className="space-y-2">
                <Label className="font-medium">1. URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`);
                      toast({
                        title: 'URL copiada',
                        description: 'A URL do webhook foi copiada para a área de transferência.',
                      });
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure no Asaas: Integrações → Webhooks → Nova configuração
                </p>
              </div>
              
              {/* Token Section */}
              <div className="space-y-2">
                <Label className="font-medium flex items-center gap-2">
                  2. Token de Autenticação
                  {isSecretConfigured ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Não configurado
                    </Badge>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type={showSecrets['ASAAS_WEBHOOK_SECRET'] ? 'text' : 'password'}
                    value={webhookSecretValue}
                    onChange={(e) => setEditedSettings(prev => ({ ...prev, 'ASAAS_WEBHOOK_SECRET': e.target.value }))}
                    placeholder="Defina um token seguro (ex: minha-escola-webhook-2024)"
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowSecret('ASAAS_WEBHOOK_SECRET')}
                  >
                    {showSecrets['ASAAS_WEBHOOK_SECRET'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {webhookSecretValue && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookSecretValue);
                        toast({
                          title: 'Token copiado',
                          description: 'Use este token no campo "Token de acesso" do webhook no Asaas.',
                        });
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Este token deve ser configurado no campo <strong>"Token de acesso"</strong> do webhook no painel Asaas
                </p>
                {!webhookSecret && webhookSecretValue && (
                  <p className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Clique em "Salvar alterações" para criar esta configuração
                  </p>
                )}
              </div>
              
              {/* Instructions */}
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">📋 Passo a passo</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Defina um token seguro no campo acima e salve</li>
                  <li>Acesse o <strong>Painel Asaas</strong> → <strong>Integrações</strong> → <strong>Webhooks</strong></li>
                  <li>Clique em <strong>"Nova configuração"</strong></li>
                  <li>Cole a <strong>URL</strong> do webhook acima</li>
                  <li>No campo <strong>"Token de acesso"</strong>, cole o mesmo token definido aqui</li>
                  <li>Selecione os eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE</li>
                  <li>Salve a configuração no Asaas</li>
                </ol>
              </div>
              
              {/* Supported Events */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Eventos suportados
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_CONFIRMED</code> - Pagamento confirmado</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_RECEIVED</code> - Pagamento recebido</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_OVERDUE</code> - Pagamento em atraso</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_REFUNDED</code> - Pagamento estornado</li>
                </ul>
              </div>
              
              {/* Security Warning */}
              {!isSecretConfigured && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <h4 className="font-medium mb-1 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Aviso de Segurança
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sem o token de autenticação configurado, o webhook aceita requisições de qualquer origem. 
                    Configure um token para garantir que apenas o Asaas possa enviar notificações.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'financial':
        return (
          <div className="space-y-6">
            {/* Discount Card */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  Desconto por Antecipação
                </CardTitle>
                <CardDescription>
                  Configure o desconto para pagamentos antecipados (Asaas)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {asaasDiscountSettings.find(s => s.key === 'asaas_discount_enabled') && (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <Label className="font-medium">Habilitar Desconto por Antecipação</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quando habilitado, os boletos terão desconto se pagos antes do vencimento
                      </p>
                    </div>
                    <Switch
                      checked={editedSettings['asaas_discount_enabled'] === 'true'}
                      onCheckedChange={(checked) => 
                        setEditedSettings(prev => ({ ...prev, 'asaas_discount_enabled': checked ? 'true' : 'false' }))
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {asaasDiscountSettings.find(s => s.key === 'asaas_discount_value') && (
                    <div className="space-y-2">
                      <Label htmlFor="asaas_discount_value" className="font-medium">
                        Valor do Desconto (%)
                      </Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="asaas_discount_value"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          className="pl-10"
                          value={editedSettings['asaas_discount_value'] || '0'}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, 'asaas_discount_value': e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {asaasDiscountSettings.find(s => s.key === 'asaas_discount_days_before') && (
                    <div className="space-y-2">
                      <Label htmlFor="asaas_discount_days_before" className="font-medium">
                        Dias de Antecedência
                      </Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="asaas_discount_days_before"
                          type="number"
                          min="0"
                          max="30"
                          step="1"
                          className="pl-10"
                          value={editedSettings['asaas_discount_days_before'] || '0'}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, 'asaas_discount_days_before': e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {editedSettings['asaas_discount_enabled'] === 'true' && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm">
                      <strong>Resumo:</strong> Desconto de{' '}
                      <span className="font-bold text-primary">
                        {editedSettings['asaas_discount_value'] || '0'}%
                      </span>{' '}
                      para pagamentos realizados até{' '}
                      <span className="font-bold text-primary">
                        {editedSettings['asaas_discount_days_before'] || '0'} dias
                      </span>{' '}
                      antes do vencimento.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interest/Fine Card */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Juros e Multa por Atraso
                </CardTitle>
                <CardDescription>
                  Configure os juros e multa para pagamentos atrasados (Asaas)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="asaas_interest_value" className="font-medium">
                      Juros ao Mês (%)
                    </Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="asaas_interest_value"
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        className="pl-10"
                        value={editedSettings['asaas_interest_value'] || '1'}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, 'asaas_interest_value': e.target.value }))}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="asaas_fine_value" className="font-medium">
                      Multa por Atraso (%)
                    </Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="asaas_fine_value"
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        className="pl-10"
                        value={editedSettings['asaas_fine_value'] || '2'}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, 'asaas_fine_value': e.target.value }))}
                        placeholder="2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Máximo legal: 2%
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm">
                    <strong>Resumo:</strong> Pagamentos em atraso terão{' '}
                    <span className="font-bold text-destructive">
                      {editedSettings['asaas_fine_value'] || '2'}% de multa
                    </span>{' '}
                    mais{' '}
                    <span className="font-bold text-destructive">
                      {editedSettings['asaas_interest_value'] || '1'}% de juros ao mês
                    </span>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'other':
        return (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Outras Configurações
              </CardTitle>
              <CardDescription>
                Configurações gerais do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {otherSettings.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma configuração adicional
                </p>
              ) : (
                otherSettings.map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={setting.key} className="font-medium">
                        {setting.key}
                      </Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSetting(setting.id, setting.key)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {setting.description && (
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    )}
                    {setting.key === 'ASAAS_ENVIRONMENT' ? (
                      <Select
                        value={editedSettings[setting.key] || 'sandbox'}
                        onValueChange={(value) => setEditedSettings(prev => ({ ...prev, [setting.key]: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                          <SelectItem value="production">Production (Produção)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={setting.key}
                        value={editedSettings[setting.key] || ''}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, [setting.key]: e.target.value }))}
                        placeholder="Valor"
                      />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );

      case 'docs':
        return <SystemDocumentation />;

      default:
        return null;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Gerencie as configurações do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Configuração
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="w-4 h-4" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <MessageSquareIcon className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Sidebar Navigation */}
              <div className="w-56 shrink-0">
                <nav className="space-y-1 sticky top-4">
                  {settingsSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                        activeSection === section.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <section.icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{section.label}</p>
                        <p className={cn(
                          "text-xs truncate",
                          activeSection === section.id ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {section.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {renderSectionContent()}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="automations">
          <AutomationControlPanel />
        </TabsContent>

        <TabsContent value="logs">
          <MessageLogsViewer />
        </TabsContent>
      </Tabs>

      {/* Add Setting Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Configuração</DialogTitle>
            <DialogDescription>
              Adicione uma nova configuração ao sistema
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddSetting} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-key">Chave *</Label>
              <Input
                id="new-key"
                value={newSetting.key}
                onChange={(e) => setNewSetting(prev => ({ ...prev, key: e.target.value }))}
                placeholder="Ex: API_KEY, CONFIG_NAME"
              />
              <p className="text-xs text-muted-foreground">
                A chave será convertida para maiúsculas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-value">Valor</Label>
              <Input
                id="new-value"
                type={newSetting.is_secret ? 'password' : 'text'}
                value={newSetting.value}
                onChange={(e) => setNewSetting(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Valor da configuração"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-description">Descrição</Label>
              <Input
                id="new-description"
                value={newSetting.description}
                onChange={(e) => setNewSetting(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição da configuração"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="new-is-secret">Valor secreto</Label>
                <p className="text-xs text-muted-foreground">
                  Valores secretos são ocultados na interface
                </p>
              </div>
              <Switch
                id="new-is-secret"
                checked={newSetting.is_secret}
                onCheckedChange={(checked) => setNewSetting(prev => ({ ...prev, is_secret: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Criar Configuração
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
