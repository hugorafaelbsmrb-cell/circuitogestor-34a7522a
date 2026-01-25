import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { WhatsAppNotificationListener } from '@/components/notifications/WhatsAppNotificationListener';
import { PreEnrollmentNotificationListener } from '@/components/notifications/PreEnrollmentNotificationListener';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Enable inactivity timeout - logs out after 20 minutes of inactivity
  useInactivityTimeout();

  return (
    <div className="min-h-screen bg-background">
      {/* Global WhatsApp message notifications */}
      <WhatsAppNotificationListener />
      
      {/* Global pre-enrollment notifications */}
      <PreEnrollmentNotificationListener />
      
      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Sidebar - responsive with drawer on mobile */}
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main content - adjust margin for sidebar on desktop, padding-top for header on mobile */}
      <main className="lg:ml-64 pt-16 lg:pt-0 p-4 lg:p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
