import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';
import { useSystemBranding } from '@/hooks/useSystemBranding';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { branding } = useSystemBranding();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {branding.logo ? (
          <img 
            src={branding.logo} 
            alt={branding.name} 
            className="w-8 h-8 rounded-lg object-contain"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
        )}
        <h1 className="font-semibold text-foreground text-sm">{branding.name}</h1>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon"
        onClick={onMenuClick}
        className="h-10 w-10"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </Button>
    </header>
  );
}
