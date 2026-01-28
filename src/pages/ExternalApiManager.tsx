import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Key, ShoppingBag, FolderTree, Package, Users, FileText, Image, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ProductsTab } from '@/components/external-api/ProductsTab';
import { CategoriesTab } from '@/components/external-api/CategoriesTab';
import { OrdersTab } from '@/components/external-api/OrdersTab';
import { UsersTab } from '@/components/external-api/UsersTab';
import { SiteContentTab } from '@/components/external-api/SiteContentTab';
import { ImagesTab } from '@/components/external-api/ImagesTab';
import { useExternalApiConfig } from '@/hooks/useExternalApiConfig';

export default function ExternalApiManager() {
  const { toast } = useToast();
  const { apiKey, setApiKey, baseUrl, setBaseUrl, isConfigured, testConnection, isTestingConnection, connectionStatus } = useExternalApiConfig();
  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempBaseUrl, setTempBaseUrl] = useState(baseUrl);

  const handleSaveConfig = () => {
    if (!tempApiKey.trim()) {
      toast({
        title: 'Erro',
        description: 'A chave de API é obrigatória',
        variant: 'destructive',
      });
      return;
    }
    
    setApiKey(tempApiKey);
    setBaseUrl(tempBaseUrl);
    toast({
      title: 'Configuração salva',
      description: 'A chave de API foi salva com sucesso',
    });
  };

  const handleTestConnection = async () => {
    await testConnection();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciador API Externa</h1>
        <p className="text-muted-foreground">Gerencie produtos, pedidos e conteúdo do site institucional</p>
      </div>

      {/* API Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configuração da API
          </CardTitle>
          <CardDescription>
            Configure a chave de API para conectar ao site institucional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL Base da API</Label>
              <Input
                id="baseUrl"
                type="text"
                value={tempBaseUrl}
                onChange={(e) => setTempBaseUrl(e.target.value)}
                placeholder="https://exemplo.supabase.co/functions/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Chave de API</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="sk_sua_chave_aqui"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button onClick={handleSaveConfig}>
              Salvar Configuração
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={!isConfigured || isTestingConnection}
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                'Testar Conexão'
              )}
            </Button>
            
            {connectionStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Conexão OK</span>
              </div>
            )}
            {connectionStatus === 'error' && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">Falha na conexão</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Management Tabs */}
      {isConfigured ? (
        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="products" className="gap-2">
              <ShoppingBag className="h-4 w-4 hidden sm:block" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderTree className="h-4 w-4 hidden sm:block" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4 hidden sm:block" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <FileText className="h-4 w-4 hidden sm:block" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <Image className="h-4 w-4 hidden sm:block" />
              Imagens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="orders">
            <OrdersTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="content">
            <SiteContentTab />
          </TabsContent>
          <TabsContent value="images">
            <ImagesTab />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Configure a API</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Para começar a gerenciar o site institucional, configure a URL base e a chave de API acima.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
