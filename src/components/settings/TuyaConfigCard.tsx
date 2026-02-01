import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTuyaDevices } from '@/hooks/useTuyaDevices';
import { Lightbulb, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';

const TUYA_ENDPOINTS = [
  { value: 'https://openapi.tuyaus.com', label: 'América (EUA)' },
  { value: 'https://openapi.tuyacn.com', label: 'China' },
  { value: 'https://openapi.tuyaeu.com', label: 'Europa' },
  { value: 'https://openapi.tuyain.com', label: 'Índia' },
];

export function TuyaConfigCard() {
  const { toast } = useToast();
  const { testConnection } = useTuyaDevices();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [endpoint, setEndpoint] = useState('https://openapi.tuyaus.com');
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['tuya_client_id', 'tuya_client_secret', 'tuya_api_endpoint']);

    if (data) {
      const map = Object.fromEntries(data.map(s => [s.key, s.value]));
      setClientId(map['tuya_client_id'] || '');
      setClientSecret(map['tuya_client_secret'] || '');
      setEndpoint(map['tuya_api_endpoint'] || 'https://openapi.tuyaus.com');
    }
  };

  const saveSetting = async (key: string, value: string, isSecret: boolean = false) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ 
        key, 
        value, 
        is_secret: isSecret,
        description: key === 'tuya_client_id' ? 'Tuya IoT Platform Client ID' :
                     key === 'tuya_client_secret' ? 'Tuya IoT Platform Client Secret' :
                     'Tuya API Endpoint URL'
      }, { onConflict: 'key' });
    
    if (error) throw error;
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha o Client ID e Client Secret',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all([
        saveSetting('tuya_client_id', clientId.trim()),
        saveSetting('tuya_client_secret', clientSecret.trim(), true),
        saveSetting('tuya_api_endpoint', endpoint),
      ]);

      toast({
        title: 'Salvo',
        description: 'Credenciais Tuya salvas com sucesso',
      });
      setConnectionStatus('idle');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar credenciais',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    
    const success = await testConnection();
    setConnectionStatus(success ? 'success' : 'error');
    
    setIsTesting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Tuya IoT Platform
            </CardTitle>
            <CardDescription>
              Configure as credenciais para controlar lâmpadas e tomadas inteligentes
            </CardDescription>
          </div>
          {connectionStatus === 'success' && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Conectado</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Falha</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tuya-endpoint">Região da API</Label>
          <Select value={endpoint} onValueChange={setEndpoint}>
            <SelectTrigger id="tuya-endpoint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TUYA_ENDPOINTS.map(ep => (
                <SelectItem key={ep.value} value={ep.value}>
                  {ep.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tuya-client-id">Client ID (Access ID)</Label>
          <Input
            id="tuya-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Seu Access ID do projeto Tuya"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tuya-client-secret">Client Secret (Access Secret)</Label>
          <div className="relative">
            <Input
              id="tuya-client-secret"
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Seu Access Secret do projeto Tuya"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Credenciais'
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={isTesting || !clientId || !clientSecret}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              'Testar Conexão'
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground pt-2 border-t">
          <p className="font-medium mb-1">Como obter as credenciais:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Acesse <a href="https://iot.tuya.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">iot.tuya.com</a></li>
            <li>Crie uma conta e um projeto "Smart Home"</li>
            <li>Vincule sua conta do app Smart Life/Tuya</li>
            <li>Copie o Access ID e Access Secret</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
