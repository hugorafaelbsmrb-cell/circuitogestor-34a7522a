import { useState, useEffect } from 'react';
import { Mail, Server, Lock, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EmailConfig {
  // IMAP
  email_imap_host: string;
  email_imap_port: string;
  email_imap_user: string;
  email_imap_password: string;
  email_imap_tls: string;
  // SMTP
  email_smtp_host: string;
  email_smtp_port: string;
  email_smtp_user: string;
  email_smtp_password: string;
  email_smtp_secure: string;
  email_from_address: string;
  email_from_name: string;
}

const defaultConfig: EmailConfig = {
  email_imap_host: '',
  email_imap_port: '993',
  email_imap_user: '',
  email_imap_password: '',
  email_imap_tls: 'true',
  email_smtp_host: '',
  email_smtp_port: '465',
  email_smtp_user: '',
  email_smtp_password: '',
  email_smtp_secure: 'true',
  email_from_address: '',
  email_from_name: '',
};

export function EmailConfigCard() {
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [imapStatus, setImapStatus] = useState<'success' | 'error' | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<'success' | 'error' | null>(null);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'email_%');

    if (data && !error) {
      const configMap = data.reduce((acc, item) => {
        acc[item.key as keyof EmailConfig] = item.value || '';
        return acc;
      }, {} as Partial<EmailConfig>);

      setConfig({ ...defaultConfig, ...configMap });
    }
  };

  const handleChange = (key: keyof EmailConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Reset status when config changes
    if (key.includes('imap')) setImapStatus(null);
    if (key.includes('smtp')) setSmtpStatus(null);
  };

  const saveConfig = async () => {
    setIsSaving(true);

    try {
      const updates = Object.entries(config).map(([key, value]) => ({
        key,
        value: value || null,
        description: getDescription(key),
        is_secret: key.includes('password'),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(update, { onConflict: 'key' });

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'As configurações de email foram atualizadas',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async (type: 'imap' | 'smtp') => {
    const setTesting = type === 'imap' ? setIsTestingImap : setIsTestingSmtp;
    const setStatus = type === 'imap' ? setImapStatus : setSmtpStatus;

    setTesting(true);
    setStatus(null);

    try {
      const payload =
        type === 'imap'
          ? {
              type: 'imap',
              host: config.email_imap_host,
              port: parseInt(config.email_imap_port),
              user: config.email_imap_user,
              password: config.email_imap_password,
              secure: config.email_imap_tls === 'true',
            }
          : {
              type: 'smtp',
              host: config.email_smtp_host,
              port: parseInt(config.email_smtp_port),
              user: config.email_smtp_user,
              password: config.email_smtp_password,
              secure: config.email_smtp_secure === 'true',
            };

      const { data, error } = await supabase.functions.invoke('email-config-test', {
        body: payload,
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Falha na conexão');
      }

      setStatus('success');
      toast({
        title: 'Conexão bem sucedida',
        description: `${type.toUpperCase()} conectado com sucesso`,
      });
    } catch (error: any) {
      setStatus('error');
      toast({
        title: 'Falha na conexão',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const getDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      email_imap_host: 'Servidor IMAP para leitura de emails',
      email_imap_port: 'Porta do servidor IMAP',
      email_imap_user: 'Usuário de autenticação IMAP',
      email_imap_password: 'Senha de autenticação IMAP',
      email_imap_tls: 'Usar conexão segura TLS/SSL',
      email_smtp_host: 'Servidor SMTP para envio de emails',
      email_smtp_port: 'Porta do servidor SMTP',
      email_smtp_user: 'Usuário de autenticação SMTP',
      email_smtp_password: 'Senha de autenticação SMTP',
      email_smtp_secure: 'Usar conexão segura TLS/SSL',
      email_from_address: 'Endereço de email remetente',
      email_from_name: 'Nome exibido como remetente',
    };
    return descriptions[key] || '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Configurações de Email
        </CardTitle>
        <CardDescription>
          Configure as credenciais IMAP e SMTP para ler e enviar emails
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="imap">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="imap">IMAP (Leitura)</TabsTrigger>
            <TabsTrigger value="smtp">SMTP (Envio)</TabsTrigger>
          </TabsList>

          <TabsContent value="imap" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imap-host">Servidor IMAP</Label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="imap-host"
                    placeholder="imap.exemplo.com"
                    value={config.email_imap_host}
                    onChange={(e) => handleChange('email_imap_host', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-port">Porta</Label>
                <Input
                  id="imap-port"
                  type="number"
                  placeholder="993"
                  value={config.email_imap_port}
                  onChange={(e) => handleChange('email_imap_port', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imap-user">Usuário (Email)</Label>
              <Input
                id="imap-user"
                type="email"
                placeholder="seu@email.com"
                value={config.email_imap_user}
                onChange={(e) => handleChange('email_imap_user', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imap-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="imap-password"
                  type={showImapPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={config.email_imap_password}
                  onChange={(e) => handleChange('email_imap_password', e.target.value)}
                  className="pl-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowImapPassword(!showImapPassword)}
                >
                  {showImapPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="imap-tls"
                  checked={config.email_imap_tls === 'true'}
                  onCheckedChange={(checked) =>
                    handleChange('email_imap_tls', checked ? 'true' : 'false')
                  }
                />
                <Label htmlFor="imap-tls">Conexão segura (TLS/SSL)</Label>
              </div>
              <div className="flex items-center gap-2">
                {imapStatus === 'success' && (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                )}
                {imapStatus === 'error' && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('imap')}
                  disabled={isTestingImap || !config.email_imap_host}
                >
                  {isTestingImap ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="smtp" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">Servidor SMTP</Label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="smtp-host"
                    placeholder="smtp.exemplo.com"
                    value={config.email_smtp_host}
                    onChange={(e) => handleChange('email_smtp_host', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Porta</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="465"
                  value={config.email_smtp_port}
                  onChange={(e) => handleChange('email_smtp_port', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-user">Usuário (Email)</Label>
              <Input
                id="smtp-user"
                type="email"
                placeholder="seu@email.com"
                value={config.email_smtp_user}
                onChange={(e) => handleChange('email_smtp_user', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="smtp-password"
                  type={showSmtpPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={config.email_smtp_password}
                  onChange={(e) => handleChange('email_smtp_password', e.target.value)}
                  className="pl-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                >
                  {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-address">Email Remetente</Label>
                <Input
                  id="from-address"
                  type="email"
                  placeholder="contato@escola.com"
                  value={config.email_from_address}
                  onChange={(e) => handleChange('email_from_address', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-name">Nome Remetente</Label>
                <Input
                  id="from-name"
                  placeholder="Escola XYZ"
                  value={config.email_from_name}
                  onChange={(e) => handleChange('email_from_name', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="smtp-secure"
                  checked={config.email_smtp_secure === 'true'}
                  onCheckedChange={(checked) =>
                    handleChange('email_smtp_secure', checked ? 'true' : 'false')
                  }
                />
                <Label htmlFor="smtp-secure">Conexão segura (TLS/SSL)</Label>
              </div>
              <div className="flex items-center gap-2">
                {smtpStatus === 'success' && (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                )}
                {smtpStatus === 'error' && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('smtp')}
                  disabled={isTestingSmtp || !config.email_smtp_host}
                >
                  {isTestingSmtp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-6">
          <Button onClick={saveConfig} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
