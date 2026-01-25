import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { Download, Share, Plus, CheckCircle, Smartphone, Monitor, ArrowLeft } from 'lucide-react';

export default function InstallApp() {
  const navigate = useNavigate();
  const { canInstall, isInstalled, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const { branding } = useSystemBranding();

  // Redirect if already in standalone mode
  useEffect(() => {
    if (isStandalone) {
      // Already running as PWA, redirect to home
    }
  }, [isStandalone]);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      // Installation successful
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.name} className="w-16 h-16 object-contain rounded-xl" />
            ) : (
              <img src="/pwa-192x192.png" alt="EduGestor" className="w-16 h-16 object-contain rounded-xl" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground">{branding.name}</h1>
          <p className="text-muted-foreground">Instale o aplicativo para uma experiência completa</p>
        </div>

        {/* Already Installed Card */}
        {isInstalled && (
          <Card className="border-primary/50 bg-primary/10">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Aplicativo Instalado!</h2>
              <p className="text-muted-foreground mb-4">
                O aplicativo já está instalado no seu dispositivo.
              </p>
              <Button onClick={() => navigate('/')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Sistema
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Android/Desktop Install */}
        {!isInstalled && canInstall && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Instalar Aplicativo
              </CardTitle>
              <CardDescription>
                Adicione o aplicativo à sua tela inicial para acesso rápido
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Smartphone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">Acesso Offline</p>
                  <p className="text-xs text-muted-foreground">Funciona mesmo sem internet</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Monitor className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">Tela Cheia</p>
                  <p className="text-xs text-muted-foreground">Experiência como app nativo</p>
                </div>
              </div>
              <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                <Download className="w-4 h-4" />
                Instalar Agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* iOS Instructions */}
        {!isInstalled && isIOS && !canInstall && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share className="w-5 h-5 text-primary" />
                Instalar no iPhone/iPad
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar o aplicativo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      Toque no botão <Share className="inline w-4 h-4" /> <strong>Compartilhar</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      Role e toque em <Plus className="inline w-4 h-4" /> <strong>Adicionar à Tela de Início</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      Toque em <strong>Adicionar</strong> para confirmar
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generic Instructions */}
        {!isInstalled && !canInstall && !isIOS && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Como Instalar
              </CardTitle>
              <CardDescription>
                Instale o aplicativo através do menu do navegador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Procure por "Instalar aplicativo" ou "Adicionar à tela inicial" no menu do navegador
                </p>
                <p className="text-xs text-muted-foreground">
                  Geralmente está no menu de três pontos (⋮) ou três linhas (☰)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h3 className="font-medium text-foreground mb-3">Vantagens do App</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Acesso rápido pela tela inicial
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Funciona offline (dados em cache)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Carregamento mais rápido
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Experiência em tela cheia
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
