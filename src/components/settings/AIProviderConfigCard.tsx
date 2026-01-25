import { useState, useEffect } from 'react';
import { Bot, Sparkles, Loader2, CheckCircle, Key, Eye, EyeOff, Save, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAIProvider, AIProvider } from '@/hooks/useAIProvider';
import { supabase } from '@/integrations/supabase/client';

export function AIProviderConfigCard() {
  const { toast } = useToast();
  const { provider, isLoading, updateProvider } = useAIProvider();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(provider);
  const [isSaving, setIsSaving] = useState(false);
  
  // Google API Key state
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setSelectedProvider(provider);
  }, [provider]);

  useEffect(() => {
    fetchGoogleApiKey();
  }, []);

  const fetchGoogleApiKey = async () => {
    setIsLoadingApiKey(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'GOOGLE_API_KEY')
        .maybeSingle();

      if (!error && data?.value) {
        setGoogleApiKey(data.value);
        setHasApiKey(true);
      }
    } catch (error) {
      console.error('Error fetching Google API Key:', error);
    }
    setIsLoadingApiKey(false);
  };

  const handleProviderChange = async (value: AIProvider) => {
    setSelectedProvider(value);
    setIsSaving(true);

    const success = await updateProvider(value);
    
    if (success) {
      toast({
        title: 'Provedor de IA atualizado',
        description: `O sistema agora usará ${getProviderLabel(value)}.`,
      });
    } else {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar a configuração.',
        variant: 'destructive',
      });
      setSelectedProvider(provider);
    }

    setIsSaving(false);
  };

  const getProviderLabel = (value: AIProvider) => {
    switch (value) {
      case 'lovable':
        return 'Lovable AI';
      case 'gemini':
        return 'Google Gemini';
      case 'huggingface':
        return 'Hugging Face';
      default:
        return value;
    }
  };

  const handleSaveApiKey = async () => {
    if (!googleApiKey.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a chave da API do Google.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingApiKey(true);

    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'GOOGLE_API_KEY')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: googleApiKey.trim(), is_secret: true })
          .eq('key', 'GOOGLE_API_KEY');
      } else {
        await supabase
          .from('app_settings')
          .insert({
            key: 'GOOGLE_API_KEY',
            value: googleApiKey.trim(),
            description: 'Chave da API do Google para o Gemini',
            is_secret: true,
          });
      }

      setHasApiKey(true);
      toast({
        title: 'Chave salva',
        description: 'A chave da API do Google foi salva com sucesso.',
      });
    } catch (error) {
      console.error('Error saving Google API Key:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a chave da API.',
        variant: 'destructive',
      });
    }

    setIsSavingApiKey(false);
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Provedor de Inteligência Artificial
        </CardTitle>
        <CardDescription>
          Escolha qual serviço de IA será usado para gerar sugestões de mensagens e análises
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selectedProvider}
          onValueChange={(value) => handleProviderChange(value as AIProvider)}
          disabled={isSaving}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="lovable" id="lovable" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="lovable" className="flex items-center gap-2 cursor-pointer font-medium">
                <Bot className="h-4 w-4 text-primary" />
                Lovable AI
                <Badge variant="secondary" className="ml-2 text-xs">Recomendado</Badge>
                {selectedProvider === 'lovable' && !isSaving && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Utiliza Google Gemini através do gateway Lovable. Melhor qualidade e mais rápido.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="gemini" id="gemini" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="gemini" className="flex items-center gap-2 cursor-pointer font-medium">
                <span className="text-lg">✨</span>
                Google Gemini
                <Badge variant="secondary" className="ml-2 text-xs">2.5 Flash</Badge>
                {selectedProvider === 'gemini' && !isSaving && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Utiliza o modelo Gemini 2.5 Flash via Google AI API. Requer chave de API própria.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="huggingface" id="huggingface" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="huggingface" className="flex items-center gap-2 cursor-pointer font-medium">
                <span className="text-lg">🤗</span>
                Hugging Face
                <Badge variant="outline" className="ml-2 text-xs">GLM-4</Badge>
                {selectedProvider === 'huggingface' && !isSaving && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Utiliza o modelo GLM-4.7 Flash via Hugging Face Router.
              </p>
            </div>
          </div>
        </RadioGroup>

        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando configuração...
          </div>
        )}

        {/* Google API Key Configuration - only show when gemini is selected */}
        {selectedProvider === 'gemini' && (
          <div className="pt-4 border-t border-border/50 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-500" />
              <h4 className="font-medium">Chave da API do Google</h4>
            </div>
            
            {!hasApiKey && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Para usar o Google Gemini, você precisa configurar sua chave de API.
                  Obtenha uma em{' '}
                  <a 
                    href="https://aistudio.google.com/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Google AI Studio
                  </a>.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="google-api-key">Chave da API</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="google-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={showApiKey ? googleApiKey : maskApiKey(googleApiKey)}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="AIza..."
                    disabled={isLoadingApiKey}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <Button 
                  onClick={handleSaveApiKey} 
                  disabled={isSavingApiKey || isLoadingApiKey}
                >
                  {isSavingApiKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span className="ml-2">Salvar</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sua chave será armazenada de forma segura e usada apenas para chamadas à API do Google.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
