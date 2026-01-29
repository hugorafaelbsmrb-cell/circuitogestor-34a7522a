import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Cloud, Eye, EyeOff, Save, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export function DropboxConfigCard() {
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
        .eq('key', 'DROPBOX_ACCESS_TOKEN')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        setToken(data.value);
        setIsConfigured(true);
      }
    } catch (error) {
      console.error('Error fetching Dropbox token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      toast({
        title: 'Token obrigatório',
        description: 'Informe o token de acesso do Dropbox',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'DROPBOX_ACCESS_TOKEN')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({ value: token.trim() })
          .eq('key', 'DROPBOX_ACCESS_TOKEN');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: 'DROPBOX_ACCESS_TOKEN',
            value: token.trim(),
            description: 'Token de acesso do Dropbox para upload de imagens',
            is_secret: true,
          });

        if (error) throw error;
      }

      setIsConfigured(true);
      toast({
        title: 'Token salvo',
        description: 'O token do Dropbox foi configurado com sucesso',
      });
    } catch (error) {
      console.error('Error saving Dropbox token:', error);
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
    if (!confirm('Tem certeza que deseja remover o token do Dropbox?')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'DROPBOX_ACCESS_TOKEN');

      if (error) throw error;

      setToken('');
      setIsConfigured(false);
      toast({
        title: 'Token removido',
        description: 'A configuração do Dropbox foi removida',
      });
    } catch (error) {
      console.error('Error clearing Dropbox token:', error);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o token',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
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
          <Cloud className="w-5 h-5" />
          Armazenamento em Nuvem
          {isConfigured && (
            <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
          )}
        </CardTitle>
        <CardDescription>
          Configure o token de acesso para upload de imagens nos relatórios pedagógicos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dropbox-token">Access Token</Label>
          <div className="relative">
            <Input
              id="dropbox-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="sl.xxxxxxxxxxxxxxxxxxxxxxx"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
          <p className="font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Como obter o token (Dropbox):
          </p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1">
            <li>
              Acesse o{' '}
              <a 
                href="https://www.dropbox.com/developers/apps" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Dropbox App Console
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Crie um novo app ou selecione um existente</li>
            <li>Em "OAuth 2", clique em "Generate" para criar o token</li>
            <li>Copie o token gerado e cole aqui</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            Permissões necessárias: files.content.write, files.content.read, sharing.write
          </p>
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
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={isSaving}
            >
              Remover
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
