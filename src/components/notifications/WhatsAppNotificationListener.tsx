import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSchool } from '@/contexts/SchoolContext';

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
  const { toast } = useToast();
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
            const messagePreview = newMessage.message.length > 100
              ? newMessage.message.substring(0, 100) + '...'
              : newMessage.message;
            
            toast({
              title: `📱 Nova mensagem de ${senderName}`,
              description: messagePreview,
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, toast]);

  // This component doesn't render anything
  return null;
}
