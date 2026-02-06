import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, FileCheck, FileX, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_APPROVED = 'Olá {nome}! 🎉\n\nSeu relatório de *{aluno}* foi *APROVADO* e já está disponível no portal dos pais.\n\n📅 Data: {data}\n📋 Título: {titulo}\n\nObrigado pelo excelente trabalho!';
const DEFAULT_REJECTED = 'Olá {nome}!\n\nSeu relatório de *{aluno}* precisa de *REVISÃO*.\n\n📅 Data: {data}\n📋 Título: {titulo}\n\n⚠️ *Motivo:* {motivo}\n\nPor favor, faça os ajustes necessários e reenvie.';

export function TeacherReportNotificationCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [templateApproved, setTemplateApproved] = useState(DEFAULT_APPROVED);
  const [templateRejected, setTemplateRejected] = useState(DEFAULT_REJECTED);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('key', 'auto_teacher_report_notification')
      .single();

    if (data) {
      setEnabled(data.enabled || false);
      const config = typeof data.config === 'string' ? JSON.parse(data.config) : data.config || {};
      setTemplateApproved(config.template_approved || DEFAULT_APPROVED);
      setTemplateRejected(config.template_rejected || DEFAULT_REJECTED);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          key: 'auto_teacher_report_notification',
          enabled,
          config: {
            template_approved: templateApproved,
            template_rejected: templateRejected,
          },
          description: 'Notificação automática para professores sobre status de relatórios',
        });

      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const variables = [
    { name: '{nome}', desc: 'Primeiro nome do professor' },
    { name: '{aluno}', desc: 'Nome do aluno' },
    { name: '{data}', desc: 'Data do relatório' },
    { name: '{titulo}', desc: 'Título do relatório' },
    { name: '{motivo}', desc: 'Motivo da rejeição (só para rejeitados)' },
  ];

  const insertVariable = (variable: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(prev => prev + variable);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Notificação de Relatórios para Professores
        </CardTitle>
        <CardDescription>
          Configure as mensagens automáticas enviadas aos professores quando seus relatórios são aprovados ou rejeitados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Notificação automática</Label>
            <p className="text-sm text-muted-foreground">
              Enviar WhatsApp ao professor sobre status do relatório
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Variáveis disponíveis</Label>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <Badge
                key={v.name}
                variant="outline"
                className="cursor-help text-xs"
                title={v.desc}
              >
                {v.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Template - Relatório Aprovado
            </Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {variables.filter(v => v.name !== '{motivo}').map((v) => (
                <Badge
                  key={v.name}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 text-xs"
                  onClick={() => insertVariable(v.name, setTemplateApproved)}
                >
                  + {v.name}
                </Badge>
              ))}
            </div>
            <Textarea
              value={templateApproved}
              onChange={(e) => setTemplateApproved(e.target.value)}
              rows={6}
              placeholder="Digite o template para relatórios aprovados..."
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileX className="w-4 h-4 text-destructive" />
              Template - Relatório Rejeitado
            </Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {variables.map((v) => (
                <Badge
                  key={v.name}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 text-xs"
                  onClick={() => insertVariable(v.name, setTemplateRejected)}
                >
                  + {v.name}
                </Badge>
              ))}
            </div>
            <Textarea
              value={templateRejected}
              onChange={(e) => setTemplateRejected(e.target.value)}
              rows={6}
              placeholder="Digite o template para relatórios rejeitados..."
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          <Save className="w-4 h-4" />
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
