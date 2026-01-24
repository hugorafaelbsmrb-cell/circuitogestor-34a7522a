import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle, Loader2, TestTube, QrCode, RefreshCw, Power, Wifi, WifiOff } from 'lucide-react';
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
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [statusDetails, setStatusDetails] = useState<string | null>(null);
  const [pollingTimeLeft, setPollingTimeLeft] = useState(0);
  
  // Refs para controle de polling
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const normalizeWapiUrl = (url?: string) => {
    const raw = (url || '').trim();
    if (!raw) return 'https://api.w-api.app';

    let base = raw;
    // Garantir HTTPS
    base = base.replace(/^http:\/\//i, 'https://');
    // Remover barras finais
    base = base.replace(/\/+$/, '');

    // Compatibilidade: valores antigos (wawp.net/app.wawp.net) apontam para outro produto.
    // A documentação atual usa https://api.w-api.app
    if (/\/\/(app\.)?wawp\.net\b/i.test(base)) {
      return 'https://api.w-api.app';
    }

    // Compatibilidade: remove /api caso o usuário tenha salvo assim no passado
    base = base.replace(/\/api$/i, '');
    return base;
  };

  const isConfigured = !!(
    editedSettings['W_API_TOKEN'] &&
    editedSettings['W_API_SESSION']
  );

  const saveSettings = async () => {
    const normalizedUrl = normalizeWapiUrl(editedSettings['W_API_URL']) || 'https://api.w-api.app';
    const settingsToSave = [
      { key: 'W_API_URL', value: normalizedUrl },
      { key: 'W_API_TOKEN', value: editedSettings['W_API_TOKEN'] },
      { key: 'W_API_SESSION', value: editedSettings['W_API_SESSION'] },
    ];

    for (const setting of settingsToSave) {
      if (!setting.value) continue;
      
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', setting.key)
        .maybeSingle();

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

      let response = await supabase.functions.invoke('wapi-get-qrcode');

      // Fallback: se o backend não conseguir acessar o host,
      // tentamos buscar o QR Code diretamente do navegador conforme a doc oficial.
      // GET https://api.w-api.app/v1/instance/qr-code?instanceId={{INSTANCE_ID}}&image=enable
      if (response.error) {
        try {
          const baseUrl = normalizeWapiUrl(editedSettings['W_API_URL']) || 'https://api.w-api.app';
          const directUrl = `${baseUrl}/v1/instance/qr-code?instanceId=${encodeURIComponent(
            editedSettings['W_API_SESSION'] || ''
          )}&image=enable`;

          const directRes = await fetch(directUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${editedSettings['W_API_TOKEN'] || ''}`,
              'Accept': 'application/json, image/png, image/*',
            },
          });

          const contentType = directRes.headers.get('content-type') || '';
          
          // Handle image response
          if (contentType.includes('image/')) {
            const blob = await directRes.blob();
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            const dataUri = await base64Promise;
            response = { data: { qrcode: dataUri, status: 'pending' }, error: null } as any;
          } else {
            const raw = await directRes.text();
            let parsed: any = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = null;
            }

            if (directRes.ok && parsed) {
              response = { data: parsed, error: null } as any;
            }
          }
        } catch (fallbackError) {
          console.error('Fallback QR fetch failed:', fallbackError);
        }
      }

      if (response.error) {
        setQrStatus('error');
        toast({
          title: 'Erro ao obter QR Code',
          description: response.error.message || 'Não foi possível gerar o QR Code. Verifique as configurações.',
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
        const qrCode =
          response.data?.qrcode ||
          response.data?.qr ||
          response.data?.base64 ||
          response.data?.qrcode_url ||
          response.data?.qr_url ||
          response.data?.data?.qrcode ||
          response.data?.data?.qr;
        if (qrCode) {
          setQrCodeData(qrCode);
          setQrStatus('pending');
        } else {
          setQrStatus('error');
          toast({
            title: 'QR Code não disponível',
            description: response.data?.error || 'Não foi possível obter o QR Code. Tente novamente.',
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

  const handleCheckStatus = async () => {
    if (!editedSettings['W_API_TOKEN'] || !editedSettings['W_API_SESSION']) {
      return;
    }

    setIsCheckingStatus(true);

    try {
      // Importante: chamar W-API direto do navegador pode falhar por CORS
      // (principalmente quando adicionamos headers customizados).
      // Aqui fazemos via backend para ficar confiável.
      await saveSettings();

      const { data, error } = await supabase.functions.invoke('wapi-connection-status');
      if (error) {
        toast({
          title: 'Erro ao verificar',
          description: error.message || 'Não foi possível verificar o status. Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      const isConnected = !!(data as any)?.connected;
      const phone = (data as any)?.phone || null;

      if (isConnected) {
        setQrStatus('connected');
        setConnectionStatus('connected');
        setStatusDetails(phone);
        toast({
          title: 'WhatsApp Conectado!',
          description: 'Sua instância está conectada e pronta para uso.',
        });
      } else {
        setConnectionStatus('unknown');
        setStatusDetails(null);
        toast({
          title: 'Aguardando conexão',
          description: 'Escaneie o QR Code com seu WhatsApp para conectar.',
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível verificar o status no momento.',
        variant: 'destructive',
      });
    }

    setIsCheckingStatus(false);
  };

  const handleDisconnect = async () => {
    if (!editedSettings['W_API_TOKEN'] || !editedSettings['W_API_SESSION']) {
      return;
    }

    setIsDisconnecting(true);

    try {
      await saveSettings();

      const { data, error } = await supabase.functions.invoke('wapi-logout');
      if (error) {
        toast({
          title: 'Erro ao desconectar',
          description: error.message || 'Não foi possível desconectar a instância.',
          variant: 'destructive',
        });
        return;
      }

      if ((data as any)?.success) {
        setConnectionStatus('unknown');
        setQrStatus('pending');
        setStatusDetails(null);
        toast({
          title: 'WhatsApp Desconectado',
          description: 'A instância foi desconectada com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao desconectar',
          description: (data as any)?.error || 'Não foi possível desconectar a instância.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Erro ao desconectar',
        description: 'Ocorreu um erro ao tentar desconectar.',
        variant: 'destructive',
      });
    }

    setIsDisconnecting(false);
  };

  // Verificar status silenciosamente (retorna boolean indicando se conectou)
  const checkStatusSilently = useCallback(async (): Promise<boolean> => {
    if (!editedSettings['W_API_TOKEN'] || !editedSettings['W_API_SESSION']) {
      return false;
    }

    try {
      const { data } = await supabase.functions.invoke('wapi-connection-status');
      const isConnected = !!(data as any)?.connected;
      const phone = (data as any)?.phone || null;
      setConnectionStatus(isConnected ? 'connected' : 'unknown');
      setStatusDetails(isConnected ? phone : null);
      return isConnected;
    } catch (error) {
      console.error('Silent status check error:', error);
      return false;
    }
  }, [editedSettings['W_API_TOKEN'], editedSettings['W_API_SESSION']]);

  // Limpar todos os intervalos de polling
  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setPollingTimeLeft(0);
  }, []);

  // Iniciar polling automático
  const startPolling = useCallback(() => {
    // Limpar polling anterior
    clearPolling();

    const POLLING_INTERVAL = 3000; // 3 segundos
    const POLLING_DURATION = 60000; // 60 segundos total
    const startTime = Date.now();

    setPollingTimeLeft(60);

    // Countdown visual
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((POLLING_DURATION - elapsed) / 1000));
      setPollingTimeLeft(remaining);
    }, 1000);

    // Polling de status
    pollingIntervalRef.current = setInterval(async () => {
      const isConnected = await checkStatusSilently();
      if (isConnected) {
        setQrStatus('connected');
        clearPolling();
        toast({
          title: 'WhatsApp Conectado!',
          description: 'Conexão detectada automaticamente.',
        });
      }
    }, POLLING_INTERVAL);

    // Timeout para parar o polling após 60s
    pollingTimeoutRef.current = setTimeout(() => {
      clearPolling();
    }, POLLING_DURATION);
  }, [checkStatusSilently, clearPolling, toast]);

  // Iniciar polling quando o modal abre com QR Code pendente
  useEffect(() => {
    if (showQrModal && qrStatus === 'pending' && qrCodeData && !isLoadingQr) {
      startPolling();
    } else {
      clearPolling();
    }

    // Cleanup ao desmontar ou fechar modal
    return () => {
      clearPolling();
    };
  }, [showQrModal, qrStatus, qrCodeData, isLoadingQr, startPolling, clearPolling]);

  // Verificar status ao montar o componente
  useEffect(() => {
    if (isConfigured) {
      checkStatusSilently();
    }
  }, [isConfigured, checkStatusSilently]);

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
            <MessageCircle className="w-5 h-5 text-primary" />
            <CardTitle>Integração WhatsApp (W-API)</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <Badge variant="default">
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
              URL da API
            </Label>
            <Input
              id="W_API_URL"
              value={editedSettings['W_API_URL'] || ''}
              onChange={(e) => setEditedSettings(prev => ({ ...prev, 'W_API_URL': e.target.value }))}
              placeholder="https://api.w-api.app"
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

        {/* Status Section */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <Wifi className="w-4 h-4 text-primary" />
              ) : (
                <WifiOff className="w-4 h-4 text-muted-foreground" />
              )}
              Status da Conexão
            </h4>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <Badge variant="default">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Conectado
                  {statusDetails && <span className="ml-1 opacity-80">({statusDetails})</span>}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Desconectado
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleCheckStatus}
              disabled={isCheckingStatus || !isConfigured}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isCheckingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Verificar Status
                </>
              )}
            </Button>

            {connectionStatus === 'connected' && (
              <Button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                {isDisconnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4" />
                    Desconectar
                  </>
                )}
              </Button>
            )}

            {connectionStatus !== 'connected' && (
              <Button
                onClick={handleGetQrCode}
                disabled={isLoadingQr || !editedSettings['W_API_TOKEN'] || !editedSettings['W_API_SESSION']}
                variant="default"
                size="sm"
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
                    Conectar WhatsApp
                  </>
                )}
              </Button>
            )}
          </div>
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
                <div className="p-4 bg-background rounded-lg border border-border">
                  {qrCodeData.startsWith('data:') || qrCodeData.startsWith('http') ? (
                    <img src={qrCodeData} alt="QR Code" className="w-64 h-64" />
                  ) : (
                    <img src={`data:image/png;base64,${qrCodeData}`} alt="QR Code" className="w-64 h-64" />
                  )}
                </div>
                
                {/* Indicador de polling automático */}
                {pollingTimeLeft > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Verificando automaticamente... ({pollingTimeLeft}s)</span>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground text-center">
                  {pollingTimeLeft > 0 
                    ? 'Escaneie o QR Code. A conexão será detectada automaticamente.'
                    : 'Abra o WhatsApp no seu celular e escaneie este código.'}
                </p>
                
                <div className="flex gap-2">
                  <Button onClick={handleCheckStatus} variant="default" size="sm" className="gap-2" disabled={isCheckingStatus}>
                    {isCheckingStatus ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Já escaneei
                      </>
                    )}
                  </Button>
                  <Button onClick={handleGetQrCode} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Atualizar QR
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
