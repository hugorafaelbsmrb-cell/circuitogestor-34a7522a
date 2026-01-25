import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import { PreEnrollmentToast } from './PreEnrollmentToast';

/**
 * Helper to get a short display name (first name only)
 */
const getFirstName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[0] || fullName;
};

/**
 * Helper to get first and second name
 */
const getFirstAndSecondName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ') || fullName;
};

interface PreEnrollmentNotificationListenerProps {
  enabled?: boolean;
}

export function PreEnrollmentNotificationListener({ enabled = true }: PreEnrollmentNotificationListenerProps) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('pre_enrollment_notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'leads',
          filter: 'status=eq.pre_enrollment'
        },
        (payload) => {
          const newLead = payload.new as { 
            name: string; 
            student_name: string | null;
            source: string | null;
          };
          
          // Only show for external form submissions
          if (newLead.source === 'external_form') {
            const guardianName = getFirstName(newLead.name);
            const studentName = newLead.student_name 
              ? getFirstAndSecondName(newLead.student_name)
              : 'Não informado';
            
            // Show custom toast
            sonnerToast.custom((toastId) => (
              <PreEnrollmentToast
                guardianName={guardianName}
                studentName={studentName}
                onClose={() => sonnerToast.dismiss(toastId)}
              />
            ), {
              duration: 10000,
              position: 'top-right',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  // This component doesn't render anything
  return null;
}
