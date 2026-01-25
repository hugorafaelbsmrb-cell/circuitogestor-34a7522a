import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { WhatsAppToast } from './WhatsAppToast';

/**
 * Normaliza telefone para comparação: remove tudo exceto dígitos,
 * e retorna os últimos 10-11 dígitos (parte nacional).
 */
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-11);
};

/**
 * Verifica se dois telefones correspondem após normalização.
 */
const phonesMatch = (phone1: string, phone2: string): boolean => {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  return n1.slice(-8) === n2.slice(-8) && n1.slice(-8).length === 8;
};

/**
 * Formata telefone para exibição
 */
const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

/**
 * Helper to get a short display name (first + second name)
 */
const getDisplayName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ') || fullName;
};

interface WhatsAppNotificationListenerProps {
  enabled?: boolean;
}

export function WhatsAppNotificationListener({ enabled = true }: WhatsAppNotificationListenerProps) {
  const { guardians } = useSchool();
  const guardiansRef = useRef(guardians);
  
  // Keep ref updated to avoid stale closure
  useEffect(() => {
    guardiansRef.current = guardians;
  }, [guardians]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('global_whatsapp_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const newMessage = payload.new as { 
            direction: string; 
            message: string; 
            phone: string;
            guardian_id: string | null;
          };
          
          // Show notification for incoming messages only
          if (newMessage.direction === 'incoming') {
            // Find guardian name if exists
            const guardian = guardiansRef.current.find(g => 
              phonesMatch(g.phone, newMessage.phone)
            );
            
            const senderName = guardian 
              ? getDisplayName(guardian.name)
              : formatPhone(newMessage.phone);
            
            // Truncate message for preview
            const messagePreview = newMessage.message.length > 80
              ? newMessage.message.substring(0, 80) + '...'
              : newMessage.message;
            
            // Show custom WhatsApp toast using sonner
            sonnerToast.custom((toastId) => (
              <WhatsAppToast
                senderName={senderName}
                message={messagePreview}
                onClose={() => sonnerToast.dismiss(toastId)}
              />
            ), {
              duration: 8000,
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
