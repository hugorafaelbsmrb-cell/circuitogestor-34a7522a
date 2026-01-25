import { useState, useEffect } from 'react';
import { Bot, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAIProvider, AIProvider } from '@/hooks/useAIProvider';

export function AIProviderConfigCard() {
  const { toast } = useToast();
  const { provider, isLoading, updateProvider } = useAIProvider();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(provider);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedProvider(provider);
  }, [provider]);

  const handleProviderChange = async (value: AIProvider) => {
    setSelectedProvider(value);
    setIsSaving(true);

    const success = await updateProvider(value);
    
    if (success) {
      toast({
        title: 'Provedor de IA atualizado',
        description: `O sistema agora usará ${value === 'lovable' ? 'Lovable AI' : 'Hugging Face'}.`,
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
      <CardContent className="space-y-4">
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
                Utiliza o modelo Gemini 2.5 Flash via Google AI API. Rápido e de alta qualidade.
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
      </CardContent>
    </Card>
  );
}
