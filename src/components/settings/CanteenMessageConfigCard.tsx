import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Save, Loader2, RotateCcw, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_TEMPLATE = `🍽️ *CONSUMO SEMANAL - CANTINA*

Olá, {nome_responsavel}! Segue o resumo da semana {semana_inicio} a {semana_fim}:

{lista_consumos}

💰 *TOTAL: {total}*

Forma de pagamento: combinar com a cantina.`;

const AVAILABLE_VARIABLES = [
  { key: '{nome_responsavel}', description: 'Primeiro nome do responsável' },
  { key: '{semana_inicio}', description: 'Data de início da semana (ex: 20/01)' },
  { key: '{semana_fim}', description: 'Data de fim da semana (ex: 24/01)' },
  { key: '{lista_consumos}', description: 'Lista detalhada de consumos por aluno' },
  { key: '{total}', description: 'Valor total formatado (ex: R$ 23,50)' },
];

export function CanteenMessageConfigCard() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [originalTemplate, setOriginalTemplate] = useState(DEFAULT_TEMPLATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'canteen_message_template')
        .maybeSingle();

      if (data?.value) {
        setTemplate(data.value);
        setOriginalTemplate(data.value);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'canteen_message_template')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: template })
          .eq('key', 'canteen_message_template');
      } else {
        await supabase
          .from('app_settings')
          .insert({
            key: 'canteen_message_template',
            value: template,
            description: 'Template de mensagem WhatsApp para resumo semanal da cantina',
            is_secret: false
          });
      }

      setOriginalTemplate(template);
      toast.success('Template salvo com sucesso!');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    setTemplate(DEFAULT_TEMPLATE);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('canteen-template') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = template.substring(0, start) + variable + template.substring(end);
      setTemplate(newText);
      // Move cursor after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setTemplate(prev => prev + variable);
    }
  };

  const hasChanges = template !== originalTemplate;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5" />
          Mensagem da Cantina
        </CardTitle>
        <CardDescription>
          Configure o template da mensagem enviada aos pais com o resumo semanal de consumo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Variables */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Clique nas variáveis para inserir no template:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map(v => (
              <Badge
                key={v.key}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => insertVariable(v.key)}
                title={v.description}
              >
                {v.key}
              </Badge>
            ))}
          </div>
        </div>

        {/* Template Editor */}
        <div className="space-y-2">
          <Textarea
            id="canteen-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Digite o template da mensagem..."
          />
        </div>

        {/* Preview Info */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">Legenda das variáveis:</p>
          <ul className="space-y-1 text-muted-foreground">
            {AVAILABLE_VARIABLES.map(v => (
              <li key={v.key}>
                <code className="text-primary">{v.key}</code>: {v.description}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
