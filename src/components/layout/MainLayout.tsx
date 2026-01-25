import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { WhatsAppNotificationListener } from '@/components/notifications/WhatsAppNotificationListener';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Enable inactivity timeout - logs out after 20 minutes of inactivity
  useInactivityTimeout();

  return (
    <div className="min-h-screen bg-background">
      {/* Global WhatsApp message notifications */}
      <WhatsAppNotificationListener />
      
      <Sidebar />
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
