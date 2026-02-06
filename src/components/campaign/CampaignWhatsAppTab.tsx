import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Loader2, 
  Save,
} from 'lucide-react';

interface CampaignWhatsAppTabProps {
  welcomeTemplate: string;
  autoWelcomeEnabled: boolean;
  onWelcomeTemplateChange: (value: string) => void;
  onAutoWelcomeEnabledChange: (value: boolean) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function CampaignWhatsAppTab({
  welcomeTemplate,
  autoWelcomeEnabled,
  onWelcomeTemplateChange,
  onAutoWelcomeEnabledChange,
  onSave,
  isSaving,
}: CampaignWhatsAppTabProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Mensagem Automática</CardTitle>
        <CardDescription>Configure a mensagem enviada automaticamente para novos leads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-base">Envio Automático</Label>
            <p className="text-sm text-muted-foreground">
              Enviar mensagem de boas-vindas assim que o lead se cadastrar
            </p>
          </div>
          <Switch
            checked={autoWelcomeEnabled}
            onCheckedChange={onAutoWelcomeEnabledChange}
          />
        </div>

        <div className="space-y-2">
          <Label>Template da Mensagem</Label>
          <Textarea
            value={welcomeTemplate}
            onChange={(e) => onWelcomeTemplateChange(e.target.value)}
            rows={8}
            placeholder="Olá {nome_responsavel}!..."
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
            <p className="font-medium mb-2">Variáveis disponíveis:</p>
            <ul className="space-y-1">
              <li><code className="bg-muted px-1 rounded">{'{nome_responsavel}'}</code> - Primeiro nome do lead</li>
              <li><code className="bg-muted px-1 rounded">{'{nome_curso}'}</code> - Curso selecionado</li>
              <li><code className="bg-muted px-1 rounded">{'{nome_escola}'}</code> - Nome da escola</li>
            </ul>
          </div>
        </div>

        <Button onClick={onSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
