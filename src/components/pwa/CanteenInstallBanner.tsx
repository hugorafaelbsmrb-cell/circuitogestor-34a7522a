import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';

export function CanteenInstallBanner() {
  const { canInstall, isInstalled, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check if user has dismissed the banner in this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('canteen-pwa-banner-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('canteen-pwa-banner-dismissed', 'true');
    setShowIOSInstructions(false);
  };

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      handleDismiss();
    }
  };

  const handleIOSClick = () => {
    setShowIOSInstructions(true);
  };

  // Don't show if already installed, dismissed, or running in standalone mode
  if (isInstalled || isStandalone || dismissed) {
    return null;
  }

  // Don't show if can't install and not iOS
  if (!canInstall && !isIOS) {
    return null;
  }

  // iOS Instructions Modal
  if (showIOSInstructions && isIOS) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-background rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Instalar Cantina</h3>
            <Button variant="ghost" size="icon" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                1
              </div>
              <p className="text-sm">
                Toque em <Share className="inline w-4 h-4" /> <strong>Compartilhar</strong>
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                2
              </div>
              <p className="text-sm">
                Toque em <Plus className="inline w-4 h-4" /> <strong>Adicionar à Tela de Início</strong>
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                3
              </div>
              <p className="text-sm">
                Toque em <strong>Adicionar</strong>
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            O app abrirá direto na cantina!
          </p>

          <Button variant="outline" className="w-full" onClick={handleDismiss}>
            Entendi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/80 backdrop-blur-sm border-b px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">Instalar App</p>
          <p className="text-xs text-muted-foreground truncate">
            Acesso rápido à cantina
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isIOS ? (
            <Button size="sm" variant="default" onClick={handleIOSClick}>
              <Download className="w-4 h-4 mr-1" />
              Instalar
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={handleInstall}>
              <Download className="w-4 h-4 mr-1" />
              Instalar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
