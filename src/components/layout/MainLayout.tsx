import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { useLastRoute } from '@/hooks/useLastRoute';
import { WhatsAppNotificationListener } from '@/components/notifications/WhatsAppNotificationListener';
import { PreEnrollmentNotificationListener } from '@/components/notifications/PreEnrollmentNotificationListener';
import { CanteenNotificationListener } from '@/components/notifications/CanteenNotificationListener';
import { ReportCommentNotificationListener } from '@/components/notifications/ReportCommentNotificationListener';

interface MainLayoutProps {
  children: ReactNode;
}

const SIDEBAR_HIDDEN_KEY = 'sidebar:hidden';

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopHidden, setDesktopHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_HIDDEN_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(desktopHidden));
  }, [desktopHidden]);

  useInactivityTimeout();
  useLastRoute();

  return (
    <div className="min-h-screen bg-background">
      <WhatsAppNotificationListener />
      <PreEnrollmentNotificationListener />
      <CanteenNotificationListener />
      <ReportCommentNotificationListener />

      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        desktopHidden={desktopHidden}
      />

      {/* Floating toggle to hide/show sidebar (desktop/tablet) */}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setDesktopHidden((v) => !v)}
        className={`hidden lg:flex fixed bottom-4 z-50 h-10 w-10 rounded-full shadow-lg border border-border ${
          desktopHidden ? 'left-4' : 'left-[17rem]'
        }`}
        aria-label={desktopHidden ? 'Mostrar menu' : 'Esconder menu'}
        title={desktopHidden ? 'Mostrar menu' : 'Esconder menu'}
      >
        {desktopHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      <main
        className={`${desktopHidden ? 'lg:ml-0' : 'lg:ml-64'} pt-16 lg:pt-0 p-4 lg:p-8 min-h-screen transition-[margin] duration-200`}
      >
        {children}
      </main>
    </div>
  );
}
