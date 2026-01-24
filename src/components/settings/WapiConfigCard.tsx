import { useState } from 'react';
import { MessageCircle, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle, Loader2, TestTube } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WapiConfigCardProps {
  editedSettings: Record<string, string>;
  setEditedSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function WapiConfigCard({ editedSettings, setEditedSettings }: WapiConfigCardProps) {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  const isConfigured = !!(
    editedSettings['W_API_URL'] && 
    editedSettings['W_API_TOKEN'] && 
    editedSettings['W_API_SESSION']
  );

  const handleTestConnection = async () => {
    if (!isConfigured) {
      toast({
        title: 'Configuração incompleta',
        description: 'Preencha todos os campos antes de testar.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);

    try {
      // First, ensure settings are saved
      const settingsToSave = [
        { key: 'W_API_URL', value: editedSettings['W_API_URL'] },
        { key: 'W_API_TOKEN', value: editedSettings['W_API_TOKEN'] },
        { key: 'W_API_SESSION', value: editedSettings['W_API_SESSION'] },
      ];

      for (const setting of settingsToSave) {
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('key', setting.key)
          .single();

        if (existing) {
          await supabase
            .from('app_settings')
            .update({ value: setting.value })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('app_settings')
            .insert({
              key: setting.key,
              value: setting.value,
              description: `W-API ${setting.key.replace('W_API_', '')}`,
              is_secret: setting.key === 'W_API_TOKEN',
            });
        }
      }

      // Test sending a message
      if (!testPhone) {
        toast({
          title: 'Número de teste necessário',
          description: 'Digite um número de telefone para enviar uma mensagem de teste.',
          variant: 'destructive',
        });
        setIsTesting(false);
        return;
      }

      const response = await supabase.functions.invoke('wapi-send-message', {
        body: { 
          phone: testPhone, 
          message: '✅ Teste de conexão W-API realizado com sucesso! Esta é uma mensagem automática do sistema.' 
        },
      });

      if (response.error) {
        setConnectionStatus('error');
        toast({
          title: 'Erro no teste',
          description: 'Não foi possível enviar a mensagem de teste. Verifique as configurações.',
          variant: 'destructive',
        });
      } else {
        setConnectionStatus('connected');
        toast({
          title: 'Teste realizado!',
          description: 'Mensagem de teste enviada com sucesso.',
        });
      }
    } catch (error) {
      console.error('Test error:', error);
      setConnectionStatus('error');
      toast({
        title: 'Erro ao testar',
        description: 'Ocorreu um erro ao testar a conexão.',
        variant: 'destructive',
      });
    }

    setIsTesting(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <CardTitle>Integração WhatsApp (W-API)</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Erro
              </Badge>
            )}
            {isConfigured && connectionStatus === 'unknown' && (
              <Badge variant="secondary">Configurado</Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Configure a API W-API para enviar mensagens de WhatsApp diretamente do sistema.{' '}
          <a 
            href="https://www.postman.com/w-api/w-api-api-do-whatsapp/folder/4yltdcv/instncia-lite" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Ver documentação <ExternalLink className="w-3 h-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="W_API_URL" className="font-medium">
              URL da API *
            </Label>
            <Input
              id="W_API_URL"
              value={editedSettings['W_API_URL'] || ''}
              onChange={(e) => setEditedSettings(prev => ({ ...prev, 'W_API_URL': e.target.value }))}
              placeholder="https://api.l2msg.com/whatsapp"
            />
            <p className="text-xs text-muted-foreground">
              URL base da sua instância W-API
            </p>
          </div>

          {/* Session Name */}
          <div className="space-y-2">
            <Label htmlFor="W_API_SESSION" className="font-medium">
              Nome da Sessão *
            </Label>
            <Input
              id="W_API_SESSION"
              value={editedSettings['W_API_SESSION'] || ''}
              onChange={(e) => setEditedSettings(prev => ({ ...prev, 'W_API_SESSION': e.target.value }))}
              placeholder="minha-sessao"
            />
            <p className="text-xs text-muted-foreground">
              Nome da sessão configurada no W-API
            </p>
          </div>
        </div>

        {/* API Token */}
        <div className="space-y-2">
          <Label htmlFor="W_API_TOKEN" className="font-medium">
            Token da API *
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="W_API_TOKEN"
                type={showToken ? 'text' : 'password'}
                value={editedSettings['W_API_TOKEN'] || ''}
                onChange={(e) => setEditedSettings(prev => ({ ...prev, 'W_API_TOKEN': e.target.value }))}
                placeholder="••••••••••••••••"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Chave de API fornecida pelo W-API (apikey)
          </p>
        </div>

        {/* Test Connection */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Testar Conexão
          </h4>
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="11999999999"
              className="flex-1"
            />
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !isConfigured}
              className="gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Enviar Teste
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Digite um número de telefone para receber uma mensagem de teste
          </p>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="font-medium mb-2">📋 Como configurar:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Acesse o painel W-API e crie uma instância</li>
            <li>Conecte seu WhatsApp escaneando o QR Code</li>
            <li>Copie a URL da API, o token e o nome da sessão</li>
            <li>Preencha os campos acima e salve as configurações</li>
            <li>Teste a conexão enviando uma mensagem de teste</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
