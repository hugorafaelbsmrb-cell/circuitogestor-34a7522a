import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileSignature, Eye, EyeOff, Save, Loader2, CheckCircle, AlertCircle, ExternalLink, Copy } from 'lucide-react';

const SETTING_KEY = 'ZAPSIGN_API_TOKEN';
const WEBHOOK_URL = `https://akxpcfqcasuabxbwyrew.supabase.co/functions/v1/zapsign-webhook`;

export function ZapSignConfigCard() {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.value) {
        setToken(data.value);
        setIsConfigured(true);
      }
    } catch (error) {
      console.error('Error fetching ZapSign token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      toast({
        title: 'Token obrigatório',
        description: 'Informe o token de API do ZapSign',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: token.trim() })
          .eq('key', SETTING_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: SETTING_KEY,
            value: token.trim(),
            description: 'Token da API do ZapSign para envio de contratos com assinatura eletrônica autenticada',
            is_secret: true,
          });
        if (error) throw error;
      }

      setIsConfigured(true);
      toast({
        title: 'Token salvo',
        description: 'O token do ZapSign foi configurado com sucesso',
      });
    } catch (error) {
      console.error('Error saving ZapSign token:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o token',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Tem certeza que deseja remover o token do ZapSign?')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', SETTING_KEY);

      if (error) throw error;

      setToken('');
      setIsConfigured(false);
      toast({
        title: 'Token removido',
        description: 'A configuração do ZapSign foi removida',
      });
    } catch (error) {
      console.error('Error clearing ZapSign token:', error);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o token',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast({
      title: 'URL copiada',
      description: 'Cole no painel do ZapSign em Configurações → Webhooks',
    });
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
          <FileSignature className="w-5 h-5" />
          ZapSign — Assinatura Eletrônica Autenticada
          {isConfigured && (
            <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
          )}
        </CardTitle>
        <CardDescription>
          Envie contratos com validade jurídica reconhecida pelo Asaas (libera antecipação de boletos).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="zapsign-token">Token da API</Label>
          <div className="relative">
            <Input
              id="zapsign-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>URL do Webhook (configure no ZapSign)</Label>
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
              Acesse o{' '}
              <a
                href="https://app.zapsign.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Painel do ZapSign
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Em <strong>Configurações → Integrações / API</strong>, copie o Token e cole acima</li>
            <li>Em <strong>Configurações → Webhooks</strong>, cole a URL acima no evento <strong>doc_signed</strong></li>
            <li>Salve e teste enviando um contrato pela página de Contratos</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !token.trim()}
            className="flex-1"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Token
          </Button>
          {isConfigured && (
            <Button variant="outline" onClick={handleClear} disabled={isSaving}>
              Remover
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
