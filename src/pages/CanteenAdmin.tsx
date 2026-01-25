import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductManagement } from '@/components/canteen/ProductManagement';
import { ConsumptionList } from '@/components/canteen/ConsumptionList';
import { WeeklySummary } from '@/components/canteen/WeeklySummary';
import { ExternalLink, Package, UtensilsCrossed, FileText, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function CanteenAdmin() {
  const publicUrl = `${window.location.origin}/cantina`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cantina</h1>
          <p className="text-muted-foreground">
            Gerencie produtos e acompanhe os consumos dos alunos
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={copyLink} className="gap-2">
            <Copy className="w-4 h-4" />
            Copiar Link
          </Button>
          <Button asChild className="gap-2">
            <a href="/cantina" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              Abrir Link Externo
            </a>
          </Button>
        </div>
      </div>

      {/* Public Link Info */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Link para o Prestador de Serviço</p>
              <p className="text-sm text-muted-foreground mb-2">
                Compartilhe este link com o responsável pela cantina para registro dos consumos:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                {publicUrl}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Cardápio</span>
          </TabsTrigger>
          <TabsTrigger value="consumptions" className="gap-2">
            <UtensilsCrossed className="w-4 h-4" />
            <span className="hidden sm:inline">Consumos</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Fechamento</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Cardápio</CardTitle>
              <CardDescription>
                Cadastre e gerencie os produtos disponíveis na cantina
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumptions">
          <Card>
            <CardHeader>
              <CardTitle>Consumos</CardTitle>
              <CardDescription>
                Visualize todos os consumos registrados por período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConsumptionList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Fechamento Semanal</CardTitle>
              <CardDescription>
                Gere e envie resumos de consumo para os responsáveis via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklySummary />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
