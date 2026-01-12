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
  CheckCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { profile } = useAuthContext();
  
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSetting, setNewSetting] = useState({
    key: '',
    value: '',
    description: '',
    is_secret: false,
  });

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
      // Initialize edited settings
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
      for (const setting of settings) {
        if (editedSettings[setting.key] !== (setting.value || '')) {
          const { error } = await supabase
            .from('app_settings')
            .update({ value: editedSettings[setting.key] || null })
            .eq('id', setting.id);
          
          if (error) throw error;
        }
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

  const hasChanges = settings.some(s => editedSettings[s.key] !== (s.value || ''));

  // Group settings
  const apiSettings = settings.filter(s => s.key.includes('API') || s.key.includes('KEY'));
  const asaasDiscountSettings = settings.filter(s => s.key.startsWith('asaas_discount'));
  const otherSettings = settings.filter(s => 
    !s.key.includes('API') && 
    !s.key.includes('KEY') && 
    !s.key.startsWith('asaas_discount') &&
    !s.key.startsWith('login_')
  );

  // Check if current user is admin
  if (profile?.role !== 'admin') {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Acesso Negado</h1>
          <p className="page-subtitle">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* API Keys Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                Configure as chaves de API para integrações externas
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

          {/* Webhook URL Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Webhook de Pagamentos
              </CardTitle>
              <CardDescription>
                Configure esta URL no painel do seu gateway de pagamento (Asaas) para receber notificações automáticas sobre o status dos pagamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-medium">URL do Webhook</Label>
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
                  Copie esta URL e configure no painel do Asaas em: Configurações → Integrações → Webhooks
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  Eventos suportados
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_CONFIRMED</code> - Pagamento confirmado</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_RECEIVED</code> - Pagamento recebido</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_OVERDUE</code> - Pagamento em atraso</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">PAYMENT_REFUNDED</code> - Pagamento estornado</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Asaas Discount Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5" />
                Desconto por Antecipação (Asaas)
              </CardTitle>
              <CardDescription>
                Configure o desconto que será aplicado automaticamente para pagamentos antecipados. 
                Este desconto é gerenciado diretamente pela API Asaas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {asaasDiscountSettings.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Configurações de desconto não encontradas
                </p>
              ) : (
                <>
                  {/* Enabled toggle */}
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
                    {/* Discount value */}
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
                        <p className="text-xs text-muted-foreground">
                          Percentual de desconto aplicado ao boleto
                        </p>
                      </div>
                    )}

                    {/* Days before */}
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
                        <p className="text-xs text-muted-foreground">
                          Até quantos dias antes do vencimento o desconto é válido
                        </p>
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Other Settings Card */}
          {otherSettings.length > 0 && (
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
                {otherSettings.map((setting) => (
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
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
