import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Loader2, 
  Save, 
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignSettingsTabProps {
  isActive: boolean;
  onIsActiveChange: (value: boolean) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function CampaignSettingsTab({
  isActive,
  onIsActiveChange,
  onSave,
  isSaving,
}: CampaignSettingsTabProps) {
  const landingPageUrl = `${window.location.origin}/campanha`;

  const copyLink = () => {
    navigator.clipboard.writeText(landingPageUrl);
    toast.success('Link copiado!');
  };

  const openPreview = () => {
    window.open(landingPageUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Configurações Gerais</CardTitle>
        <CardDescription>Controle o funcionamento da landing page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-base">Landing Page Ativa</Label>
            <p className="text-sm text-muted-foreground">
              Quando desativada, exibe mensagem de campanha encerrada
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={onIsActiveChange}
          />
        </div>

        <div className="p-4 bg-muted/30 rounded-lg space-y-3">
          <Label>Link da Landing Page</Label>
          <div className="flex items-center gap-2">
            <Input
              value={landingPageUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={copyLink} variant="outline" size="icon">
              <LinkIcon className="w-4 h-4" />
            </Button>
            <Button onClick={openPreview} variant="outline" size="icon">
              <ExternalLink className="w-4 h-4" />
            </Button>
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
