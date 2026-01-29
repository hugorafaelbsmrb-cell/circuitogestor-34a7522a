import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Save, Loader2, RotateCcw, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_TEMPLATE = `Olá, {nome_responsavel}! 👋

O relatório pedagógico de *{nome_aluno}* já está disponível! 📚

📅 Data: {data_relatorio}
📝 {titulo_relatorio}

Acesse o portal dos pais para visualizar o relatório completo e acompanhar o desenvolvimento do seu filho(a).

Atenciosamente,
*{nome_escola}*`;

const AVAILABLE_VARIABLES = [
  { key: '{nome_responsavel}', description: 'Primeiro nome do responsável' },
  { key: '{nome_aluno}', description: 'Nome completo do aluno' },
  { key: '{data_relatorio}', description: 'Data do relatório (ex: 25/01/2025)' },
  { key: '{titulo_relatorio}', description: 'Título do relatório' },
  { key: '{nome_escola}', description: 'Nome da escola (configurado em system_name)' },
];

export function ReportNotificationConfigCard() {
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
        .eq('key', 'report_notification_template')
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
        .eq('key', 'report_notification_template')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: template })
          .eq('key', 'report_notification_template');
      } else {
        await supabase
          .from('app_settings')
          .insert({
            key: 'report_notification_template',
            value: template,
            description: 'Template de mensagem WhatsApp para notificação de relatório pedagógico',
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
    const textarea = document.getElementById('report-notification-template') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = template.substring(0, start) + variable + template.substring(end);
      setTemplate(newText);
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
          <FileText className="w-5 h-5" />
          Notificação de Relatório Pedagógico
        </CardTitle>
        <CardDescription>
          Configure o template da mensagem enviada aos pais quando um relatório pedagógico está disponível
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
            id="report-notification-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="min-h-[250px] font-mono text-sm"
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
