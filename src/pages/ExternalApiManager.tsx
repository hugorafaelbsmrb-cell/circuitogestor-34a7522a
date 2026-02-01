import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Key, ShoppingBag, FolderTree, Package, Users, FileText, Image, Eye, EyeOff, CheckCircle, XCircle, Loader2, Settings, MessageSquare } from 'lucide-react';
import { ProductsTab } from '@/components/external-api/ProductsTab';
import { CategoriesTab } from '@/components/external-api/CategoriesTab';
import { OrdersTab } from '@/components/external-api/OrdersTab';
import { UsersTab } from '@/components/external-api/UsersTab';
import { SiteContentTab } from '@/components/external-api/SiteContentTab';
import { ImagesTab } from '@/components/external-api/ImagesTab';
import { ContactsTab } from '@/components/external-api/ContactsTab';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Externa</h1>
          <p className="text-muted-foreground">
            Gerencie produtos, pedidos e conteúdo do site institucional
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="config" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="products" disabled={!isConfigured} className="flex items-center gap-1">
            <ShoppingBag className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="categories" disabled={!isConfigured} className="flex items-center gap-1">
            <FolderTree className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="orders" disabled={!isConfigured} className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="users" disabled={!isConfigured} className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="content" disabled={!isConfigured} className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Conteúdo
          </TabsTrigger>
          <TabsTrigger value="images" disabled={!isConfigured} className="flex items-center gap-1">
            <Image className="h-4 w-4" />
            Imagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Configuração da API
                  </CardTitle>
                  <CardDescription>
                    Configure a chave de API para conectar ao site institucional
                  </CardDescription>
                </div>
              {connectionStatus === 'success' && (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Conexão OK</span>
                  </div>
                )}
                {connectionStatus === 'error' && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Falha na conexão</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
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
              </div>

              {!isConfigured && (
                <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-muted/30">
                  <Key className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Configure a API</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Para começar a gerenciar o site institucional, preencha a URL base e a chave de API acima e salve a configuração.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab />
        </TabsContent>

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
    </div>
  );
}
