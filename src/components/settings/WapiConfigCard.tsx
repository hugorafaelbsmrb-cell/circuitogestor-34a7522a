import { useState } from 'react';
import { MessageCircle, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle, Loader2, TestTube, QrCode, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [qrStatus, setQrStatus] = useState<'pending' | 'connected' | 'error'>('pending');

  const isConfigured = !!(
    editedSettings['W_API_URL'] && 
    editedSettings['W_API_TOKEN'] && 
    editedSettings['W_API_SESSION']
  );

  const saveSettings = async () => {
    const settingsToSave = [
      { key: 'W_API_URL', value: editedSettings['W_API_URL'] || 'https://app.wawp.net/api/' },
      { key: 'W_API_TOKEN', value: editedSettings['W_API_TOKEN'] },
      { key: 'W_API_SESSION', value: editedSettings['W_API_SESSION'] },
    ];

    for (const setting of settingsToSave) {
      if (!setting.value) continue;
      
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
  };

  const handleGetQrCode = async () => {
    if (!editedSettings['W_API_TOKEN'] || !editedSettings['W_API_SESSION']) {
      toast({
        title: 'Configuração incompleta',
        description: 'Preencha o ID e Token da instância antes de gerar o QR Code.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingQr(true);
    setShowQrModal(true);
    setQrCodeData(null);
    setQrStatus('pending');

    try {
      // Save settings first
      await saveSettings();

      const response = await supabase.functions.invoke('wapi-get-qrcode');

      if (response.error) {
        setQrStatus('error');
        toast({
          title: 'Erro ao obter QR Code',
          description: 'Não foi possível gerar o QR Code. Verifique as configurações.',
          variant: 'destructive',
        });
      } else if (response.data?.status === 'connected') {
        setQrStatus('connected');
        setConnectionStatus('connected');
        toast({
          title: 'WhatsApp conectado!',
          description: 'Sua instância já está conectada ao WhatsApp.',
        });
      } else {
        const qrCode = response.data?.qrcode || response.data?.qrcode_url;
        if (qrCode) {
          setQrCodeData(qrCode);
          setQrStatus('pending');
        } else {
          setQrStatus('error');
          toast({
            title: 'QR Code não disponível',
            description: 'Não foi possível obter o QR Code. Tente novamente.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('QR Code error:', error);
      setQrStatus('error');
      toast({
        title: 'Erro ao gerar QR Code',
        description: 'Ocorreu um erro ao buscar o QR Code.',
        variant: 'destructive',
      });
    }

    setIsLoadingQr(false);
  };

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
      // Save settings first
      await saveSettings();

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
              value={editedSettings['W_API_URL'] || 'https://wawp.net/api/'}
              onChange={(e) => setEditedSettings(prev => ({ ...prev, 'W_API_URL': e.target.value }))}
              placeholder="https://wawp.net/api/"
            />
            <p className="text-xs text-muted-foreground">
              URL base da sua instância W-API
            </p>
        </div>

          {/* Instance ID (Session) */}
          <div className="space-y-2">
            <Label htmlFor="W_API_SESSION" className="font-medium">
              ID da Instância *
            </Label>
            <Input
              id="W_API_SESSION"
              value={editedSettings['W_API_SESSION'] || ''}
              onChange={(e) => setEditedSettings(prev => ({ ...prev, 'W_API_SESSION': e.target.value }))}
              placeholder="LITE-XXXXXXXX-XXXXXX"
            />
            <p className="text-xs text-muted-foreground">
              ID da instância fornecido pelo W-API
            </p>
          </div>
        </div>

        {/* Instance Token */}
        <div className="space-y-2">
          <Label htmlFor="W_API_TOKEN" className="font-medium">
            Token da Instância *
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
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mt-2">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <span className="text-primary">ℹ</span>
              <span>
                Para autenticação, adicione o token da instância no <strong>Header</strong> da requisição, 
                no atributo <strong>Authorization</strong>, utilizando o formato: <code className="bg-muted px-1 rounded">Bearer &lt;seu_token&gt;</code>
              </span>
            </p>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            Conectar WhatsApp
          </h4>
          <p className="text-sm text-muted-foreground">
            Gere o QR Code para conectar sua instância ao WhatsApp. Após preencher o ID e Token, clique no botão abaixo.
          </p>
          <Button
            onClick={handleGetQrCode}
            disabled={isLoadingQr || !editedSettings['W_API_TOKEN'] || !editedSettings['W_API_SESSION']}
            variant="outline"
            className="gap-2"
          >
            {isLoadingQr ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                Gerar QR Code
              </>
            )}
          </Button>
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
            <li>Copie o ID e Token da sua instância no painel W-API</li>
            <li>Preencha os campos acima</li>
            <li>Clique em "Gerar QR Code" e escaneie com seu WhatsApp</li>
            <li>Após conectar, teste enviando uma mensagem</li>
          </ol>
        </div>
      </CardContent>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com seu WhatsApp para conectar a instância.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-6">
            {isLoadingQr && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
            
            {!isLoadingQr && qrStatus === 'connected' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
                <p className="text-lg font-medium">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground text-center">
                  Sua instância já está conectada e pronta para uso.
                </p>
              </div>
            )}
            
            {!isLoadingQr && qrStatus === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <p className="text-lg font-medium">Erro ao gerar QR Code</p>
                <p className="text-sm text-muted-foreground text-center">
                  Verifique as configurações e tente novamente.
                </p>
                <Button onClick={handleGetQrCode} variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </Button>
              </div>
            )}
            
            {!isLoadingQr && qrStatus === 'pending' && qrCodeData && (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-lg">
                  {qrCodeData.startsWith('data:') || qrCodeData.startsWith('http') ? (
                    <img src={qrCodeData} alt="QR Code" className="w-64 h-64" />
                  ) : (
                    <img src={`data:image/png;base64,${qrCodeData}`} alt="QR Code" className="w-64 h-64" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular e escaneie este código.
                </p>
                <Button onClick={handleGetQrCode} variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Atualizar QR Code
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
