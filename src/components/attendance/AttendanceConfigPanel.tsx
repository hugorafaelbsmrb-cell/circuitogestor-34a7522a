import { useState, useEffect } from 'react';
import { Settings, Save, Bell, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function AttendanceConfigPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [toleranceMinutes, setToleranceMinutes] = useState(15);
  const [sendImmediately, setSendImmediately] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    // Load automation setting
    const { data: automationData } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('key', 'auto_absence_notification')
      .single();

    if (automationData) {
      setAutomationEnabled(automationData.enabled || false);
      const config = typeof automationData.config === 'string' 
        ? JSON.parse(automationData.config) 
        : automationData.config || {};
      setToleranceMinutes(config.tolerance_minutes || 15);
      setSendImmediately(config.send_immediately || false);
    }

    // Load message template
    const { data: templateData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'absence_notification_template')
      .single();

    if (templateData?.value) {
      setMessageTemplate(templateData.value);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Update automation setting
      const { error: automationError } = await supabase
        .from('automation_settings')
        .upsert({
          key: 'auto_absence_notification',
          enabled: automationEnabled,
          config: {
            tolerance_minutes: toleranceMinutes,
            send_immediately: sendImmediately,
          },
          description: 'Notificação automática de ausência via WhatsApp',
        });

      if (automationError) throw automationError;

      // Update message template
      const { error: templateError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'absence_notification_template',
          value: messageTemplate,
          description: 'Template de mensagem WhatsApp para notificação de ausência',
          is_secret: false,
        });

      if (templateError) throw templateError;

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const variables = [
    { name: '{nome_responsavel}', desc: 'Primeiro nome do responsável' },
    { name: '{nome_aluno}', desc: 'Nome completo do aluno' },
    { name: '{curso}', desc: 'Nome do curso' },
    { name: '{horario}', desc: 'Horário esperado' },
    { name: '{data}', desc: 'Data formatada' },
    { name: '{nome_escola}', desc: 'Nome da escola' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificação de Ausência
          </CardTitle>
          <CardDescription>
            Configure a notificação automática via WhatsApp quando um aluno não comparecer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificação automática</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagem ao responsável quando o aluno não comparecer
              </p>
            </div>
            <Switch
              checked={automationEnabled}
              onCheckedChange={setAutomationEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo de tolerância (minutos)
            </Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={toleranceMinutes}
              onChange={(e) => setToleranceMinutes(parseInt(e.target.value) || 15)}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Após esse tempo, o aluno será marcado como ausente
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enviar imediatamente</Label>
              <p className="text-sm text-muted-foreground">
                Enviar notificação assim que o aluno for marcado como ausente
              </p>
            </div>
            <Switch
              checked={sendImmediately}
              onCheckedChange={setSendImmediately}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Template da Mensagem
          </CardTitle>
          <CardDescription>
            Personalize a mensagem que será enviada aos responsáveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <Badge
                key={v.name}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => setMessageTemplate(prev => prev + v.name)}
              >
                {v.name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Clique em uma variável para adicioná-la ao template
          </p>

          <Textarea
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={8}
            placeholder="Digite o template da mensagem..."
          />

          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
