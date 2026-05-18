import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck, Eye, EyeOff, Save, Loader2, CheckCircle, AlertCircle, ExternalLink, Copy } from 'lucide-react';

const TOKEN_KEY = 'CLICKSIGN_API_TOKEN';
const ENV_KEY = 'CLICKSIGN_ENVIRONMENT';
const WEBHOOK_URL = `https://akxpcfqcasuabxbwyrew.supabase.co/functions/v1/clicksign-webhook`;

export function ClicksignConfigCard() {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key,value')
        .in('key', [TOKEN_KEY, ENV_KEY]);
      const t = data?.find(d => d.key === TOKEN_KEY)?.value;
      const e = data?.find(d => d.key === ENV_KEY)?.value;
      if (t) { setToken(t); setIsConfigured(true); }
      if (e === 'production' || e === 'sandbox') setEnvironment(e);
    } catch (err) {
      console.error('Clicksign config load:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const upsert = async (key: string, value: string, description: string, isSecret: boolean) => {
    const { data: existing } = await supabase
      .from('app_settings').select('id').eq('key', key).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('app_settings').update({ value }).eq('key', key);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('app_settings').insert({ key, value, description, is_secret: isSecret });
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      toast({ title: 'Token obrigatório', description: 'Informe o token de API da Clicksign', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await upsert(TOKEN_KEY, token.trim(), 'Token da API Clicksign (assinatura ICP-Brasil)', true);
      await upsert(ENV_KEY, environment, 'Ambiente Clicksign (sandbox|production)', false);
      setIsConfigured(true);
      toast({ title: 'Configuração salva', description: 'Clicksign pronta para uso.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Remover o token da Clicksign?')) return;
    setIsSaving(true);
    try {
      await supabase.from('app_settings').delete().eq('key', TOKEN_KEY);
      setToken(''); setIsConfigured(false);
      toast({ title: 'Token removido' });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast({ title: 'URL copiada', description: 'Cole no painel Clicksign em API → Webhooks' });
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Clicksign — Assinatura com ICP-Brasil
          {isConfigured && <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />}
        </CardTitle>
        <CardDescription>
          Envia contratos com certificação ICP-Brasil (validade equivalente a cartório). Alternativa à ZapSign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clicksign-env">Ambiente</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
            <SelectTrigger id="clicksign-env"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clicksign-token">Access Token da API</Label>
          <div className="relative">
            <Input
              id="clicksign-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="cs_xxx..."
              className="pr-10"
            />
            <Button type="button" variant="ghost" size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>URL do Webhook (configure no painel Clicksign)</Label>
          <div className="flex gap-2">
            <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyWebhook}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
          <p className="font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Como configurar:
          </p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1">
            <li>
              Acesse o painel{' '}
              <a
                href={environment === 'production' ? 'https://app.clicksign.com' : 'https://sandbox.clicksign.com'}
                target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Clicksign ({environment === 'production' ? 'Produção' : 'Sandbox'})
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Vá em <strong>API → Access Tokens</strong>, gere um token e cole acima</li>
            <li>Em <strong>API → Webhooks</strong>, cadastre a URL acima nos eventos <strong>auto_close</strong> e <strong>sign</strong></li>
            <li>Salve e teste enviando um contrato pela página de Contratos</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving || !token.trim()} className="flex-1">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
          {isConfigured && (
            <Button variant="outline" onClick={handleClear} disabled={isSaving}>Remover</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
