import { useState, useEffect, useMemo } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MobileConversationList } from '@/components/support/MobileConversationList';
import { MobileChatView } from '@/components/support/MobileChatView';
import { ConversationData } from '@/components/support/MobileConversationItem';

interface WhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  guardian_id: string | null;
  created_at: string;
}

interface WhatsAppContact {
  phone: string;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
}

/**
 * Normalizes phone for comparison: removes everything except digits,
 * returns the last 10-11 digits (national part).
 */
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-11);
};

/**
 * Checks if two phones match after normalization.
 */
const phonesMatch = (phone1: string, phone2: string): boolean => {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  return n1.slice(-8) === n2.slice(-8) && n1.slice(-8).length === 8;
};

const formatPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) {
    return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
};

const calculateUnreadCount = (messages: WhatsAppMessage[]): { unreadCount: number; lastMessageAt: string | null } => {
  if (messages.length === 0) return { unreadCount: 0, lastMessageAt: null };
  
  const sorted = [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  const lastMessageAt = sorted[0]?.created_at || null;
  const lastOutgoingIdx = sorted.findIndex(m => m.direction === 'outgoing');
  
  if (lastOutgoingIdx === -1) {
    return { 
      unreadCount: sorted.filter(m => m.direction === 'incoming').length,
      lastMessageAt 
    };
  }
  
  const unreadCount = sorted.slice(0, lastOutgoingIdx).filter(m => m.direction === 'incoming').length;
  return { unreadCount, lastMessageAt };
};

export default function GuardianSupportMobile() {
  const { guardians, courses, students, enrollments, classGroups, refetch } = useSchool();
  const { toast } = useToast();

  const [allMessages, setAllMessages] = useState<WhatsAppMessage[]>([]);
  const [unknownMessages, setUnknownMessages] = useState<WhatsAppMessage[]>([]);
  const [whatsappContactsMap, setWhatsappContactsMap] = useState<Map<string, WhatsAppContact>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationData | null>(null);

  useEffect(() => {
    void refetch?.();
    loadData();
    
    // Subscribe to realtime updates
    const messagesChannel = supabase
      .channel('whatsapp_messages_mobile')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      const [allMessagesResult, unknownMessagesResult] = await Promise.all([
        supabase
          .from('whatsapp_messages')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('whatsapp_messages')
          .select('*')
          .is('guardian_id', null)
          .order('created_at', { ascending: false })
      ]);

      if (allMessagesResult.error) throw allMessagesResult.error;
      if (unknownMessagesResult.error) throw unknownMessagesResult.error;

      setAllMessages((allMessagesResult.data || []) as WhatsAppMessage[]);
      setUnknownMessages((unknownMessagesResult.data || []) as WhatsAppMessage[]);
      
      fetchWhatsAppContacts();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWhatsAppContacts = async () => {
    try {
      const { data } = await supabase.functions.invoke('wapi-fetch-contacts', {
        body: { perPage: 500 }
      });

      if (data?.contacts && Array.isArray(data.contacts)) {
        const contactsMap = new Map<string, WhatsAppContact>();
        data.contacts.forEach((c: WhatsAppContact) => {
          if (c.phone) {
            const normalizedPhone = normalizePhone(c.phone);
            contactsMap.set(normalizedPhone, c);
          }
        });
        setWhatsappContactsMap(contactsMap);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp contacts:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch?.(), loadData()]);
      toast({ title: 'Dados atualizados' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Build unified conversation list
  const conversations = useMemo(() => {
    const result: ConversationData[] = [];

    // Helper to get short display name
    const getDisplayName = (fullName: string): string => {
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).join(' ') || fullName;
    };

    // Process registered guardians
    guardians.forEach(guardian => {
      const guardianStudents = students.filter((s) => s.guardian_id === guardian.id);
      const activeEnrollments = enrollments.filter(
        (e) => e.guardian_id === guardian.id && e.status === 'active'
      );

      const courseNames: string[] = [];
      activeEnrollments.forEach((enrollment) => {
        const classGroup = classGroups.find((cg) => cg.id === enrollment.class_group_id);
        if (!classGroup) return;
        const course = courses.find((c) => c.id === classGroup.course_id);
        if (course && !courseNames.includes(course.name)) {
          courseNames.push(course.name);
        }
      });

      const guardianMessages = allMessages.filter(m => phonesMatch(m.phone, guardian.phone));
      const { unreadCount, lastMessageAt } = calculateUnreadCount(guardianMessages);

      const lastMsg = guardianMessages.length > 0 
        ? guardianMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

      result.push({
        id: guardian.id,
        name: getDisplayName(guardian.name),
        phone: guardian.phone,
        avatarUrl: (guardian as { avatar_url?: string | null }).avatar_url,
        studentNames: guardianStudents.map(s => s.name.split(' ')[0]),
        courseNames,
        lastMessage: lastMsg?.message || null,
        lastMessageAt,
        unreadCount,
        isRegistered: true,
      });
    });

    // Process unknown contacts
    const phoneMap = new Map<string, { messages: WhatsAppMessage[]; contact: Partial<WhatsAppContact> }>();
    
    unknownMessages.forEach(msg => {
      const matchedGuardian = guardians.find(g => phonesMatch(g.phone, msg.phone));
      if (matchedGuardian) return;

      const existing = phoneMap.get(msg.phone);
      if (existing) {
        existing.messages.push(msg);
      } else {
        const normalizedPhone = normalizePhone(msg.phone);
        const whatsappContact = whatsappContactsMap.get(normalizedPhone);
        
        phoneMap.set(msg.phone, {
          messages: [msg],
          contact: {
            phone: msg.phone,
            name: whatsappContact?.name || null,
            pushName: whatsappContact?.pushName || null,
            profilePicUrl: whatsappContact?.profilePicUrl || null,
          }
        });
      }
    });

    phoneMap.forEach(({ messages, contact }) => {
      const { unreadCount, lastMessageAt } = calculateUnreadCount(messages);
      const sorted = [...messages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const displayName = contact.pushName || contact.name || formatPhone(contact.phone || '');

      result.push({
        id: contact.phone || '',
        name: displayName,
        phone: contact.phone || '',
        avatarUrl: contact.profilePicUrl || null,
        studentNames: [],
        courseNames: [],
        lastMessage: sorted[0]?.message || null,
        lastMessageAt,
        unreadCount,
        isRegistered: false,
      });
    });

    // Sort: unread first, then by last message time
    return result.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      
      if (a.lastMessageAt && b.lastMessageAt) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [guardians, students, enrollments, classGroups, courses, allMessages, unknownMessages, whatsappContactsMap]);


  // Show chat view if conversation is selected
  if (selectedConversation) {
    return (
      <MobileChatView
        conversation={selectedConversation}
        onBack={() => setSelectedConversation(null)}
      />
    );
  }

  // Show conversation list
  return (
    <MobileConversationList
      conversations={conversations}
      courses={courses}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      onSelectConversation={setSelectedConversation}
    />
  );
}
