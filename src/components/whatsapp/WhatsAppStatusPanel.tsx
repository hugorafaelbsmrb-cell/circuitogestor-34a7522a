import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  QrCode, 
  RefreshCw, 
  Power, 
  Wifi, 
  WifiOff,
  Settings2,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';

interface WhatsAppStatusPanelProps {
  compact?: boolean;
}

export function WhatsAppStatusPanel({ compact = false }: WhatsAppStatusPanelProps) {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected' | 'error'>('unknown');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [statusDetails, setStatusDetails] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Config state
  const [config, setConfig] = useState({
    url: '',
    token: '',
    session: '',
  });

  // QR Code state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [qrStatus, setQrStatus] = useState<'pending' | 'connected' | 'error'>('pending');
  const [pollingTimeLeft, setPollingTimeLeft] = useState(0);

  // Refs para controle de polling
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PRO_BASE_URL = 'https://api.w-api.app';

  const isConfigured = !!(config.token && config.session);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);

      if (error) throw error;

      const newConfig = { url: '', token: '', session: '' };
      data?.forEach(s => {
        if (s.key === 'W_API_URL') newConfig.url = s.value || '';
        if (s.key === 'W_API_TOKEN') newConfig.token = s.value || '';
        if (s.key === 'W_API_SESSION') newConfig.session = s.value || '';
      });
      
      setConfig(newConfig);

      // Check status if configured
      if (newConfig.token && newConfig.session) {
        await checkStatusSilently(newConfig);
      }
    } catch (error) {
      console.error('Error loading W-API config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    const settingsToSave = [
      { key: 'W_API_URL', value: PRO_BASE_URL },
      { key: 'W_API_TOKEN', value: config.token },
      { key: 'W_API_SESSION', value: config.session },
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

  const checkStatusSilently = useCallback(async (configToUse = config): Promise<boolean> => {
    if (!configToUse.token || !configToUse.session) {
      return false;
    }

    try {
      const { data } = await supabase.functions.invoke('wapi-connection-status');
      const isConnected = !!(data as any)?.connected;
      const phone = (data as any)?.phone || null;
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      setStatusDetails(isConnected ? phone : null);
      return isConnected;
    } catch (error) {
      console.error('Silent status check error:', error);
      setConnectionStatus('error');
      return false;
    }
  }, [config]);

  const handleCheckStatus = async () => {
    if (!config.token || !config.session) {
      toast({
        title: 'Configuração incompleta',
        description: 'Preencha o ID e Token da instância.',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingStatus(true);
    await saveSettings();

    try {
      const { data, error } = await supabase.functions.invoke('wapi-connection-status');
      if (error) {
        toast({
          title: 'Erro ao verificar',
          description: error.message || 'Não foi possível verificar o status.',
          variant: 'destructive',
        });
        setConnectionStatus('error');
        return;
      }

      const isConnected = !!(data as any)?.connected;
      const phone = (data as any)?.phone || null;

      if (isConnected) {
        setConnectionStatus('connected');
        setStatusDetails(phone);
        toast({
          title: 'WhatsApp Conectado!',
          description: phone ? `Número: ${phone}` : 'Instância pronta para uso.',
        });
      } else {
        setConnectionStatus('disconnected');
        setStatusDetails(null);
        toast({
          title: 'Não conectado',
          description: 'Escaneie o QR Code para conectar.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      setConnectionStatus('error');
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível verificar o status.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleGetQrCode = async () => {
    if (!config.token || !config.session) {
      toast({
        title: 'Configuração incompleta',
        description: 'Preencha o ID e Token da instância.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingQr(true);
    setShowQrModal(true);
    setQrCodeData(null);
    setQrStatus('pending');

    try {
      await saveSettings();

      let response = await supabase.functions.invoke('wapi-get-qrcode');

      if (response.error) {
        // Fallback: try direct fetch
        try {
          const directUrl = `${PRO_BASE_URL}/v1/instance/qr-code?instanceId=${encodeURIComponent(config.session)}&image=enable`;
          const directRes = await fetch(directUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.token}`,
              'Accept': 'application/json, image/png, image/*',
            },
          });

          const contentType = directRes.headers.get('content-type') || '';
          
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
            try { parsed = JSON.parse(raw); } catch { parsed = null; }
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
          description: 'Não foi possível gerar o QR Code.',
          variant: 'destructive',
        });
      } else if (response.data?.status === 'connected') {
        setQrStatus('connected');
        setConnectionStatus('connected');
        toast({
          title: 'WhatsApp conectado!',
          description: 'Sua instância já está conectada.',
        });
      } else {
        const qrCode =
          response.data?.qrcode ||
          response.data?.qr ||
          response.data?.base64 ||
          response.data?.qrcode_url ||
          response.data?.data?.qrcode;
        if (qrCode) {
          setQrCodeData(qrCode);
          setQrStatus('pending');
        } else {
          setQrStatus('error');
          toast({
            title: 'QR Code não disponível',
            description: response.data?.error || 'Tente novamente.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('QR Code error:', error);
      setQrStatus('error');
    }

    setIsLoadingQr(false);
  };

  const handleDisconnect = async () => {
    if (!config.token || !config.session) return;

    setIsDisconnecting(true);
    await saveSettings();

    try {
      const { data, error } = await supabase.functions.invoke('wapi-logout');
      if (error) {
        toast({
          title: 'Erro ao desconectar',
          description: error.message || 'Não foi possível desconectar.',
          variant: 'destructive',
        });
        return;
      }

      if ((data as any)?.success) {
        setConnectionStatus('disconnected');
        setStatusDetails(null);
        toast({
          title: 'WhatsApp Desconectado',
          description: 'A instância foi desconectada.',
        });
      } else {
        toast({
          title: 'Erro ao desconectar',
          description: (data as any)?.error || 'Não foi possível desconectar.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Erro ao desconectar',
        description: 'Ocorreu um erro.',
        variant: 'destructive',
      });
    }

    setIsDisconnecting(false);
  };

  // Limpar polling
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

  // Iniciar polling
  const startPolling = useCallback(() => {
    clearPolling();

    const POLLING_INTERVAL = 3000;
    const POLLING_DURATION = 60000;
    const startTime = Date.now();

    setPollingTimeLeft(60);

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((POLLING_DURATION - elapsed) / 1000));
      setPollingTimeLeft(remaining);
    }, 1000);

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

    pollingTimeoutRef.current = setTimeout(() => {
      clearPolling();
    }, POLLING_DURATION);
  }, [checkStatusSilently, clearPolling, toast]);

  // Polling effect
  useEffect(() => {
    if (showQrModal && qrStatus === 'pending' && qrCodeData && !isLoadingQr) {
      startPolling();
    } else {
      clearPolling();
    }
    return () => clearPolling();
  }, [showQrModal, qrStatus, qrCodeData, isLoadingQr, startPolling, clearPolling]);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-5 h-5 text-primary" />;
      case 'disconnected':
        return <WifiOff className="w-5 h-5 text-muted-foreground" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <MessageCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            Conectado
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="secondary" className="gap-1">
            <WifiOff className="w-3 h-3" />
            Desconectado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" />
            Erro
          </Badge>
        );
      default:
        return isConfigured ? (
          <Badge variant="outline">Configurado</Badge>
        ) : (
          <Badge variant="outline" className="text-warning border-warning">
            Não configurado
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <CardTitle>Conexão WhatsApp</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
          <CardDescription>
            Status da integração W-API para envio de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Info */}
          {connectionStatus === 'connected' && statusDetails && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Número conectado: {statusDetails}</span>
              </div>
            </div>
          )}

          {!isConfigured && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="text-sm">Configure a W-API em Configurações &gt; WhatsApp</span>
              </div>
            </div>
          )}

          {/* Config Fields (compact mode shows minimal) */}
          {!compact && isConfigured && (
            <div className="space-y-4">
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID da Instância</Label>
                  <Input
                    value={config.session}
                    onChange={(e) => setConfig({ ...config, session: e.target.value })}
                    placeholder="Seu Instance ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token de Acesso</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={config.token}
                      onChange={(e) => setConfig({ ...config, token: e.target.value })}
                      placeholder="Seu Token"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={!isConfigured || isCheckingStatus}
              className="gap-2"
            >
              {isCheckingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Verificar Status
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGetQrCode}
              disabled={!isConfigured || isLoadingQr}
              className="gap-2"
            >
              {isLoadingQr ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              Gerar QR Code
            </Button>

            {connectionStatus === 'connected' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="gap-2 text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
                Desconectar
              </Button>
            )}
          </div>

          {/* Link to full settings */}
          <div className="pt-2">
            <a 
              href="/configuracoes" 
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" />
              Configurações avançadas
            </a>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {isLoadingQr && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}

            {!isLoadingQr && qrStatus === 'connected' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-medium">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground">Você já pode enviar mensagens.</p>
              </div>
            )}

            {!isLoadingQr && qrStatus === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-lg font-medium">Erro ao gerar QR Code</p>
                <Button onClick={handleGetQrCode} variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {!isLoadingQr && qrStatus === 'pending' && qrCodeData && (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-lg">
                  <img
                    src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
                {pollingTimeLeft > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Verificando conexão automaticamente... ({pollingTimeLeft}s)
                  </p>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleGetQrCode} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                  </Button>
                  <Button onClick={handleCheckStatus} variant="outline" size="sm" className="gap-2">
                    <Wifi className="w-4 h-4" />
                    Verificar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
