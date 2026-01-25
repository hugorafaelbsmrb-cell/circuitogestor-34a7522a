import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Phone,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Edit,
  Star,
  UserX,
  Calculator,
  Wrench,
  BookOpen,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSchool } from '@/contexts/SchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageHistoryModal } from '@/components/support/MessageHistoryModal';

interface SupportTicket {
  id: string;
  guardian_id: string;
  course_id: string | null;
  status: 'pending' | 'in_progress' | 'waiting_response' | 'completed';
  subject: string;
  notes: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface WhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  guardian_id: string | null;
  created_at: string;
}

// Column types for the Kanban
type ColumnType = 'reforco' | 'robotica' | 'soroban' | 'vip' | 'unknown';

const COLUMN_CONFIG: Record<ColumnType, { 
  label: string; 
  color: string; 
  icon: React.ReactNode;
  description: string;
}> = {
  reforco: { 
    label: 'Reforço Escolar', 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    icon: <BookOpen className="h-4 w-4" />,
    description: 'Pais de alunos do Reforço'
  },
  robotica: { 
    label: 'Robótica', 
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    icon: <Wrench className="h-4 w-4" />,
    description: 'Pais de alunos da Robótica'
  },
  soroban: { 
    label: 'Soroban', 
    color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    icon: <Calculator className="h-4 w-4" />,
    description: 'Pais de alunos do Soroban'
  },
  vip: { 
    label: 'Pais VIP', 
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    icon: <Star className="h-4 w-4" />,
    description: '+1 aluno ou curso'
  },
  unknown: { 
    label: 'Não Matriculados', 
    color: 'bg-gray-500/10 text-gray-600 border-gray-200',
    icon: <UserX className="h-4 w-4" />,
    description: 'Contatos sem matrícula'
  },
};

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600' },
  waiting_response: { label: 'Aguardando', color: 'bg-purple-500/10 text-purple-600' },
  completed: { label: 'Concluído', color: 'bg-green-500/10 text-green-600' },
};

/**
 * Normaliza telefone para comparação: remove tudo exceto dígitos,
 * e retorna os últimos 10-11 dígitos (parte nacional).
 */
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  // Retorna últimos 11 dígitos (DDD + 9 dígitos) ou menos se o número for curto
  return digits.slice(-11);
};

/**
 * Verifica se dois telefones correspondem após normalização.
 */
const phonesMatch = (phone1: string, phone2: string): boolean => {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  // Compara os últimos 8 dígitos para tolerância a variações de DDD/país
  return n1.slice(-8) === n2.slice(-8) && n1.slice(-8).length === 8;
};

const COLUMNS: ColumnType[] = ['reforco', 'robotica', 'soroban', 'vip', 'unknown'];

interface GuardianWithCategory {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  category: ColumnType;
  studentCount: number;
  courseCount: number;
  courseNames: string[];
  tickets: SupportTicket[];
  unreadCount: number;
  lastMessageAt: string | null;
}

interface UnknownContact {
  phone: string;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
}

interface WhatsAppContact {
  phone: string;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
}

export default function GuardianSupport() {
  const { guardians, courses, students, enrollments, classGroups, refetch } = useSchool();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [allMessages, setAllMessages] = useState<WhatsAppMessage[]>([]);
  const [unknownMessages, setUnknownMessages] = useState<WhatsAppMessage[]>([]);
  const [whatsappContactsMap, setWhatsappContactsMap] = useState<Map<string, WhatsAppContact>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  
  // Message history modal state
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [selectedGuardianForMessages, setSelectedGuardianForMessages] = useState<{
    id: string | null;
    name: string;
    phone: string;
    studentNames: string[];
    avatarUrl?: string | null;
    courseNames?: string[];
  } | null>(null);

  // Mark as Lead dialog state
  const [showMarkAsLeadDialog, setShowMarkAsLeadDialog] = useState(false);
  const [markAsLeadContact, setMarkAsLeadContact] = useState<UnknownContact | null>(null);
  const [leadCourseId, setLeadCourseId] = useState<string>('');
  const [isCreatingLead, setIsCreatingLead] = useState(false);

  const [formGuardian, setFormGuardian] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPriority, setFormPriority] = useState<SupportTicket['priority']>('normal');
  const [formCourse, setFormCourse] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useManualPhone, setUseManualPhone] = useState(false);
  const [manualPhone, setManualPhone] = useState('');

  useEffect(() => {
    // Força uma atualização inicial dos dados escolares quando a página abre,
    // para evitar Kanban “defasado” após matrículas recentes.
    void refetch?.();

    loadData();
    
    // Subscribe to realtime updates
    const ticketsChannel = supabase
      .channel('guardian_support_tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guardian_support_tickets' },
        () => loadData()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('whatsapp_messages_support')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      const [ticketsResult, allMessagesResult, unknownMessagesResult] = await Promise.all([
        supabase
          .from('guardian_support_tickets')
          .select('*')
          .order('created_at', { ascending: false }),
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

      if (ticketsResult.error) throw ticketsResult.error;
      if (allMessagesResult.error) throw allMessagesResult.error;
      if (unknownMessagesResult.error) throw unknownMessagesResult.error;

      setTickets((ticketsResult.data || []) as SupportTicket[]);
      setAllMessages((allMessagesResult.data || []) as WhatsAppMessage[]);
      setUnknownMessages((unknownMessagesResult.data || []) as WhatsAppMessage[]);
      
      // Fetch WhatsApp contacts to enrich unknown contacts with names
      fetchWhatsAppContacts();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os atendimentos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWhatsAppContacts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('wapi-fetch-contacts', {
        body: { perPage: 500 }
      });

      if (error) {
        console.error('Error fetching WhatsApp contacts:', error);
        return;
      }

      if (data?.contacts && Array.isArray(data.contacts)) {
        const contactsMap = new Map<string, WhatsAppContact>();
        data.contacts.forEach((c: WhatsAppContact) => {
          if (c.phone) {
            // Normalize phone for matching
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

  // Helper to get a short display name (first + second name)
  const getDisplayName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).join(' ') || fullName;
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch?.(), loadData()]);
      toast({
        title: 'Dados atualizados',
        description: 'Cadastros, matrículas e atendimentos foram recarregados.',
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível recarregar os dados agora.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper to calculate unread messages count
  // Unread = incoming messages after last outgoing message (or all incoming if no outgoing)
  const calculateUnreadCount = (messages: WhatsAppMessage[]): { unreadCount: number; lastMessageAt: string | null } => {
    if (messages.length === 0) return { unreadCount: 0, lastMessageAt: null };
    
    // Sort by date desc to get latest first
    const sorted = [...messages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    const lastMessageAt = sorted[0]?.created_at || null;
    
    // Find the last outgoing message
    const lastOutgoingIdx = sorted.findIndex(m => m.direction === 'outgoing');
    
    if (lastOutgoingIdx === -1) {
      // No outgoing messages - all incoming are "unread"
      return { 
        unreadCount: sorted.filter(m => m.direction === 'incoming').length,
        lastMessageAt 
      };
    }
    
    // Count incoming messages before the last outgoing (i.e., newer than last outgoing)
    const unreadCount = sorted.slice(0, lastOutgoingIdx).filter(m => m.direction === 'incoming').length;
    return { unreadCount, lastMessageAt };
  };

  // Categorize guardians by course/VIP status
  const categorizedGuardians = useMemo(() => {
    const result: Record<ColumnType, GuardianWithCategory[]> = {
      reforco: [],
      robotica: [],
      soroban: [],
      vip: [],
      unknown: [],
    };

    // Map course names to columns
    const getCourseColumn = (courseName: string): ColumnType | null => {
      const lowerName = courseName.toLowerCase();
      if (lowerName.includes('reforço') || lowerName.includes('reforco')) return 'reforco';
      if (lowerName.includes('robótica') || lowerName.includes('robotica')) return 'robotica';
      if (lowerName.includes('soroban')) return 'soroban';
      return null;
    };

    guardians.forEach(guardian => {
      // Alunos desse responsável
      const guardianStudents = students.filter((s) => s.guardian_id === guardian.id);

      // Matrículas ativas desse responsável (caminho mais confiável do que inferir via aluno)
      const activeEnrollments = enrollments.filter(
        (e) => e.guardian_id === guardian.id && e.status === 'active'
      );

      // Cursos derivados das matrículas ativas
      const courseIds = new Set<string>();
      const courseNames: string[] = [];
      activeEnrollments.forEach((enrollment) => {
        const classGroup = classGroups.find((cg) => cg.id === enrollment.class_group_id);
        if (!classGroup) return;

        courseIds.add(classGroup.course_id);
        const course = courses.find((c) => c.id === classGroup.course_id);
        if (course && !courseNames.includes(course.name)) {
          courseNames.push(course.name);
        }
      });

      const studentCount = guardianStudents.length;
      const courseCount = courseIds.size;
      const guardianTickets = tickets.filter(t => t.guardian_id === guardian.id);

      // Get messages for this guardian (by phone match)
      const guardianMessages = allMessages.filter(m => phonesMatch(m.phone, guardian.phone));
      const { unreadCount, lastMessageAt } = calculateUnreadCount(guardianMessages);

      // Determine category
      // VIP: more than 1 student OR more than 1 course
      const isVip = studentCount > 1 || courseCount > 1;

      const guardianData: GuardianWithCategory = {
        id: guardian.id,
        name: guardian.name,
        phone: guardian.phone,
        avatarUrl: (guardian as { avatar_url?: string | null }).avatar_url,
        category: isVip ? 'vip' : 'reforco',
        studentCount,
        courseCount,
        courseNames,
        tickets: guardianTickets,
        unreadCount,
        lastMessageAt,
      };

      if (isVip) {
        guardianData.category = 'vip';
        result.vip.push(guardianData);
      } else if (courseNames.length > 0) {
        // Single course - categorize by course type
        const column = getCourseColumn(courseNames[0]);
        if (column) {
          guardianData.category = column;
          result[column].push(guardianData);
        }
      }
    });

    // Sort each column: unread first (by most recent), then read ones (oldest first to go to bottom)
    Object.keys(result).forEach((key) => {
      const column = key as ColumnType;
      result[column].sort((a, b) => {
        // Unread messages first
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        
        // Both have unread: most recent first (urgent ones on top)
        if (a.unreadCount > 0 && b.unreadCount > 0) {
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          }
        }
        
        // Both are read: oldest last message goes to bottom (least recently active)
        if (a.unreadCount === 0 && b.unreadCount === 0) {
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          }
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
        }
        
        // Finally alphabetically
        return a.name.localeCompare(b.name);
      });
    });

    return result;
  }, [guardians, students, enrollments, classGroups, courses, tickets, allMessages]);

  // Group unknown phone numbers - excluding those that match a registered guardian
  // and enrich with WhatsApp contact info (name, pushName, profilePic)
  const unknownContacts = useMemo(() => {
    const phoneMap = new Map<string, { messages: WhatsAppMessage[]; contact: Partial<UnknownContact> }>();
    
    unknownMessages.forEach(msg => {
      // Verifica se esse telefone corresponde a algum guardian cadastrado
      const matchedGuardian = guardians.find(g => phonesMatch(g.phone, msg.phone));
      if (matchedGuardian) {
        // Este telefone pertence a um guardian cadastrado, não é "desconhecido"
        return;
      }

      const existing = phoneMap.get(msg.phone);
      if (existing) {
        existing.messages.push(msg);
        if (new Date(msg.created_at) > new Date(existing.contact.lastMessageAt!)) {
          existing.contact.lastMessage = msg.message;
          existing.contact.lastMessageAt = msg.created_at;
        }
        existing.contact.messageCount = (existing.contact.messageCount || 0) + 1;
      } else {
        // Try to find WhatsApp contact info
        const normalizedPhone = normalizePhone(msg.phone);
        const whatsappContact = whatsappContactsMap.get(normalizedPhone);
        
        phoneMap.set(msg.phone, {
          messages: [msg],
          contact: {
            phone: msg.phone,
            name: whatsappContact?.name || null,
            pushName: whatsappContact?.pushName || null,
            profilePicUrl: whatsappContact?.profilePicUrl || null,
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            messageCount: 1,
          }
        });
      }
    });

    // Calculate unread count for each unknown contact
    const contacts: UnknownContact[] = Array.from(phoneMap.values()).map(({ messages, contact }) => {
      const { unreadCount } = calculateUnreadCount(messages);
      return {
        phone: contact.phone!,
        name: contact.name || null,
        pushName: contact.pushName || null,
        profilePicUrl: contact.profilePicUrl || null,
        lastMessage: contact.lastMessage!,
        lastMessageAt: contact.lastMessageAt!,
        messageCount: contact.messageCount!,
        unreadCount,
      };
    });

    // Sort: unread first (most recent), then read ones (most recent first among read)
    return contacts.sort((a, b) => {
      // Unread messages first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      
      // Both have unread: most recent first
      if (a.unreadCount > 0 && b.unreadCount > 0) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
      
      // Both are read: most recent first
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [unknownMessages, guardians, whatsappContactsMap]);

  const handleCreateTicket = async () => {
    if (!formGuardian || !formSubject.trim()) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione um responsável e informe o assunto.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('guardian_support_tickets')
        .insert({
          guardian_id: formGuardian,
          subject: formSubject.trim(),
          notes: formNotes.trim() || null,
          priority: formPriority,
          course_id: formCourse === 'none' ? null : formCourse || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Atendimento criado',
        description: 'O ticket foi adicionado.',
      });

      resetForm();
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: 'Erro ao criar',
        description: 'Não foi possível criar o atendimento.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTicket = async () => {
    if (!editingTicket) return;

    setIsSaving(true);
    try {
      const updateData: Partial<SupportTicket> = {
        subject: formSubject.trim(),
        notes: formNotes.trim() || null,
        priority: formPriority,
        course_id: formCourse === 'none' ? null : formCourse || null,
      };

      const { error } = await supabase
        .from('guardian_support_tickets')
        .update(updateData)
        .eq('id', editingTicket.id);

      if (error) throw error;

      toast({
        title: 'Atendimento atualizado',
        description: 'As alterações foram salvas.',
      });

      resetForm();
      setShowEditDialog(false);
      setEditingTicket(null);
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o atendimento.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('guardian_support_tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Atendimento excluído',
        description: 'O ticket foi removido.',
      });
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o atendimento.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (ticket: SupportTicket) => {
    setEditingTicket(ticket);
    setFormGuardian(ticket.guardian_id);
    setFormSubject(ticket.subject);
    setFormNotes(ticket.notes || '');
    setFormPriority(ticket.priority);
    setFormCourse(ticket.course_id || 'none');
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormGuardian('');
    setFormSubject('');
    setFormNotes('');
    setFormPriority('normal');
    setFormCourse('');
    setUseManualPhone(false);
    setManualPhone('');
  };

  const openManualPhoneChat = () => {
    const cleanPhone = manualPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast({
        title: 'Número inválido',
        description: 'Digite um número de telefone válido.',
        variant: 'destructive',
      });
      return;
    }
    
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    setSelectedGuardianForMessages({
      id: null,
      name: formatPhone(formattedPhone),
      phone: formattedPhone,
      studentNames: [],
    });
    setShowMessagesModal(true);
    setShowCreateDialog(false);
    resetForm();
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
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

  const openMarkAsLeadDialog = (contact: UnknownContact) => {
    setMarkAsLeadContact(contact);
    setLeadCourseId('');
    setShowMarkAsLeadDialog(true);
  };

  const handleConfirmMarkAsLead = async () => {
    if (!markAsLeadContact) return;
    
    setIsCreatingLead(true);
    try {
      const displayName = markAsLeadContact.pushName || markAsLeadContact.name || formatPhone(markAsLeadContact.phone);
      
      // Check if lead already exists with this phone
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', markAsLeadContact.phone)
        .maybeSingle();
      
      if (existingLead) {
        toast({
          title: 'Lead já existe',
          description: `Já existe um lead cadastrado com este telefone.`,
        });
        setShowMarkAsLeadDialog(false);
        setMarkAsLeadContact(null);
        return;
      }
      
      // Fetch profile picture from WhatsApp API
      let profilePictureUrl: string | null = markAsLeadContact.profilePicUrl;
      
      if (!profilePictureUrl) {
        try {
          const { data: picData } = await supabase.functions.invoke('wapi-get-profile-picture', {
            body: { phone: markAsLeadContact.phone }
          });
          if (picData?.profilePictureUrl) {
            profilePictureUrl = picData.profilePictureUrl;
          }
        } catch (picError) {
          console.log('Could not fetch profile picture:', picError);
        }
      }
      
      // Get course name for notes
      const selectedCourse = courses.find(c => c.id === leadCourseId);
      const courseNote = selectedCourse ? `Curso de interesse: ${selectedCourse.name}. ` : '';
      
      // Create new lead with avatar_url
      const { error } = await supabase
        .from('leads')
        .insert({
          name: displayName,
          phone: markAsLeadContact.phone,
          source: 'whatsapp',
          status: 'new',
          interested_course_id: leadCourseId || null,
          avatar_url: profilePictureUrl,
          notes: `${courseNote}Criado automaticamente a partir do Atendimento aos Pais. Última mensagem: ${markAsLeadContact.lastMessage.substring(0, 100)}`,
        });
      
      if (error) throw error;
      
      toast({
        title: 'Lead criado',
        description: `${displayName} foi adicionado à lista de leads.`,
      });
      
      setShowMarkAsLeadDialog(false);
      setMarkAsLeadContact(null);
      
      // Reload data to update the UI
      loadData();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: 'Erro ao criar lead',
        description: 'Não foi possível criar o lead. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingLead(false);
    }
  };

  const handleSyncMessages = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wapi-sync-messages');

      if (error) throw error;

      // Check detected plan
      if (data?.plan === 'LITE') {
        toast({
          title: 'Plano LITE detectado',
          description: 'O histórico de mensagens não está disponível neste plano. Mensagens novas são capturadas automaticamente via webhook.',
        });
        return;
      }

      const _debugSummary = (() => {
        const samples = data?.debug?.samples as
          | Array<{ phoneSuffix: string; attempts: Array<{ endpoint: string; status: number | null; ok: boolean; note?: string }> }>
          | undefined;
        if (!samples?.length) return '';

        const shortEndpoint = (endpoint: string) => {
          try {
            return new URL(endpoint).pathname;
          } catch {
            return endpoint;
          }
        };

        return samples
          .map((s) => {
            const parts = (s.attempts || [])
              .slice(0, 4)
              .map((a) => `${shortEndpoint(a.endpoint)}=${a.status ?? 'timeout'}`)
              .join(', ');
            return `${s.phoneSuffix}: ${parts}`;
          })
          .join(' | ');
      })();

      // Even if the backend returned success=true previously, 0 synced means we need to show the derived reason.
      if ((data?.synced || 0) === 0) {
        // Check if all attempts failed with 404 - indicates endpoint not available
        const allFailed404 = data?.debug?.samples?.every((s: any) => 
          s.attempts?.every((a: any) => a.status === 404 || a.status === null)
        );
        
        const message = allFailed404
          ? 'Esta instância não suporta busca de histórico retroativo. Configure o webhook para captura em tempo real das novas mensagens.'
          : (data?.message || 'Verifique se a instância está conectada e há histórico de conversa.');
        
        toast({
          title: allFailed404 ? 'Histórico não disponível' : 'Nenhuma mensagem sincronizada',
          description: message,
          variant: allFailed404 ? 'default' : 'destructive',
        });
        return;
      }

      toast({
        title: `Sincronização concluída${data?.plan ? ` (${data.plan})` : ''}`,
        description: `${data?.synced || 0} mensagens sincronizadas de ${data?.chatsProcessed || 0} conversas.`,
      });

      // Reload data to show new messages
      loadData();
    } catch (error) {
      console.error('Error syncing messages:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar as mensagens do WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimento aos Pais</h1>
          <p className="text-muted-foreground">Organizado por curso e categoria</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar dados'}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSyncMessages}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar WhatsApp'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Atendimento
          </Button>
        </div>
      </div>

      {/* Kanban Board - Columns by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {COLUMNS.map((columnType) => {
          const config = COLUMN_CONFIG[columnType];
          const guardiansInColumn = categorizedGuardians[columnType];
          const isUnknownColumn = columnType === 'unknown';

          return (
            <div
              key={columnType}
              className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]"
            >
              {/* Column Header */}
              <div className={`rounded-t-lg px-4 py-3 ${config.color} border`}>
                <div className="flex items-center gap-2">
                  {config.icon}
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{config.label}</h3>
                    <p className="text-xs opacity-75">{config.description}</p>
                  </div>
                  <Badge variant="secondary" className="bg-background">
                    {isUnknownColumn ? unknownContacts.length : guardiansInColumn.length}
                  </Badge>
                </div>
              </div>

              {/* Column Content */}
              <ScrollArea className="flex-1 border-x border-b rounded-b-lg bg-muted/30">
                <div className="p-2 space-y-2">
                  {/* Unknown Contacts Column */}
                  {isUnknownColumn && unknownContacts.map((contact) => {
                    // Get display name: pushName > name > formatted phone
                    const displayName = contact.pushName || contact.name || formatPhone(contact.phone);
                    const hasName = !!(contact.pushName || contact.name);
                    
                    return (
                      <Card 
                        key={contact.phone} 
                        className={`hover:shadow-md transition-shadow ${
                          contact.unreadCount > 0 
                            ? 'ring-2 ring-primary/50 bg-primary/5' 
                            : ''
                        }`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative">
                                <Avatar className="h-8 w-8 shrink-0">
                                  {contact.profilePicUrl ? (
                                    <AvatarImage src={contact.profilePicUrl} alt={displayName} />
                                  ) : null}
                                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                    {hasName 
                                      ? displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                                      : <UserX className="h-4 w-4" />
                                    }
                                  </AvatarFallback>
                                </Avatar>
                                {contact.unreadCount > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                                    {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-sm block truncate">
                                  {displayName}
                                </span>
                                {hasName && (
                                  <span className="text-xs text-muted-foreground block truncate">
                                    {formatPhone(contact.phone)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedGuardianForMessages({
                                    id: null,
                                    name: displayName,
                                    phone: contact.phone,
                                    studentNames: [],
                                  });
                                  setShowMessagesModal(true);
                                }}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Ver Mensagens
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openWhatsApp(contact.phone)}>
                                  <Phone className="h-4 w-4 mr-2" />
                                  Abrir WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openMarkAsLeadDialog(contact)}>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Marcar como Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {contact.lastMessage}
                          </p>

                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-xs">
                              {contact.messageCount} msg
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(contact.lastMessageAt), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs h-7"
                              onClick={() => {
                                setSelectedGuardianForMessages({
                                  id: null,
                                  name: displayName,
                                  phone: contact.phone,
                                  studentNames: [],
                                });
                                setShowMessagesModal(true);
                              }}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Mensagens
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 text-xs h-7"
                              onClick={() => openMarkAsLeadDialog(contact)}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Lead
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Guardians in Category */}
                  {!isUnknownColumn && guardiansInColumn.map((guardian) => (
                    <Card 
                      key={guardian.id} 
                      className={`hover:shadow-md transition-shadow ${
                        guardian.unreadCount > 0 
                          ? 'ring-2 ring-primary/50 bg-primary/5' 
                          : ''
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={guardian.avatarUrl || undefined} alt={guardian.name} />
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                  {guardian.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {guardian.unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                                  {guardian.unreadCount > 9 ? '9+' : guardian.unreadCount}
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-sm">
                              {getDisplayName(guardian.name)}
                            </span>
                            {guardian.category === 'vip' && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => {
                                const guardianStudentNames = students
                                  .filter(s => s.guardian_id === guardian.id)
                                  .map(s => s.name);
                                setSelectedGuardianForMessages({
                                  id: guardian.id,
                                  name: getDisplayName(guardian.name),
                                  phone: guardian.phone,
                                  studentNames: guardianStudentNames,
                                  avatarUrl: guardian.avatarUrl,
                                  courseNames: guardian.courseNames,
                                });
                                setShowMessagesModal(true);
                              }}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Ver Mensagens
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openWhatsApp(guardian.phone)}>
                                <Phone className="h-4 w-4 mr-2" />
                                Abrir WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setFormGuardian(guardian.id);
                                setShowCreateDialog(true);
                              }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Novo Ticket
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Student Names - show first and second name only */}
                        {(() => {
                          const guardianStudents = students.filter(s => s.guardian_id === guardian.id);
                          if (guardianStudents.length === 0) return null;
                          const getFirstTwoNames = (name: string) => {
                            const parts = name.split(' ');
                            return parts.slice(0, 2).join(' ');
                          };
                          return (
                            <p className="text-xs text-muted-foreground mt-1 ml-6">
                              {guardianStudents.map(s => getFirstTwoNames(s.name)).join(', ')}
                            </p>
                          );
                        })()}

                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {formatPhone(guardian.phone)}
                        </p>

                        {/* Ver Mensagens Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 text-xs h-7"
                          onClick={() => {
                            const guardianStudentNames = students
                              .filter(s => s.guardian_id === guardian.id)
                              .map(s => s.name);
                            setSelectedGuardianForMessages({
                              id: guardian.id,
                              name: getDisplayName(guardian.name),
                              phone: guardian.phone,
                              studentNames: guardianStudentNames,
                              avatarUrl: guardian.avatarUrl,
                              courseNames: guardian.courseNames,
                            });
                            setShowMessagesModal(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Ver Mensagens
                        </Button>

                        {/* VIP Info */}
                        {guardian.category === 'vip' && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="outline" className="text-xs bg-purple-50">
                              {guardian.studentCount} aluno{guardian.studentCount > 1 ? 's' : ''}
                            </Badge>
                            {guardian.courseNames.map((name, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {name.split(' ')[0]}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Tickets for this guardian */}
                        {guardian.tickets.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {guardian.tickets.slice(0, 2).map((ticket) => (
                              <div
                                key={ticket.id}
                                className="flex items-center justify-between p-2 bg-background rounded border text-xs"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Badge className={`${STATUS_CONFIG[ticket.status].color} text-[10px] px-1`}>
                                    {STATUS_CONFIG[ticket.status].label}
                                  </Badge>
                                  <span className="truncate">{ticket.subject}</span>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-popover">
                                    <DropdownMenuItem onClick={() => openEditDialog(ticket)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteTicket(ticket.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                            {guardian.tickets.length > 2 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{guardian.tickets.length - 2} ticket(s)
                              </p>
                            )}
                          </div>
                        )}

                        {guardian.tickets.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Sem tickets abertos
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {/* Empty State */}
                  {((isUnknownColumn && unknownContacts.length === 0) || 
                    (!isUnknownColumn && guardiansInColumn.length === 0)) && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum contato
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Atendimento</DialogTitle>
            <DialogDescription>
              Crie um ticket ou envie mensagem para um número específico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Toggle: Responsável cadastrado ou Número manual */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Button
                type="button"
                variant={!useManualPhone ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setUseManualPhone(false)}
                className="flex-1"
              >
                Responsável Cadastrado
              </Button>
              <Button
                type="button"
                variant={useManualPhone ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setUseManualPhone(true)}
                className="flex-1"
              >
                Número Manual
              </Button>
            </div>

            {useManualPhone ? (
              <>
                <div className="space-y-2">
                  <Label>Número do WhatsApp *</Label>
                  <Input
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="Ex: 11999998888"
                    type="tel"
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite o número com DDD (sem o 55)
                  </p>
                </div>

                <DialogFooter className="sm:justify-between">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={openManualPhoneChat} 
                    disabled={!manualPhone.trim()}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Abrir Conversa
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Responsável *</Label>
                  <Select value={formGuardian} onValueChange={setFormGuardian}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {guardians.map((guardian) => (
                        <SelectItem key={guardian.id} value={guardian.id}>
                          {guardian.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assunto *</Label>
                  <Input
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Ex: Dúvida sobre pagamento"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Detalhes adicionais..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={formPriority} onValueChange={(v) => setFormPriority(v as SupportTicket['priority'])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Curso</Label>
                    <Select value={formCourse} onValueChange={setFormCourse}>
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {courses.filter(c => c.is_active).map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateTicket} disabled={isSaving}>
                    {isSaving ? 'Criando...' : 'Criar Atendimento'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Atendimento</DialogTitle>
            <DialogDescription>
              Atualize as informações do ticket.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input
                value={guardians.find(g => g.id === formGuardian)?.name || 'Desconhecido'}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Assunto *</Label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Ex: Dúvida sobre pagamento"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as SupportTicket['priority'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Curso</Label>
                <Select value={formCourse} onValueChange={setFormCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {courses.filter(c => c.is_active).map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTicket} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message History Modal */}
      {selectedGuardianForMessages && (
        <MessageHistoryModal
          open={showMessagesModal}
          onOpenChange={(open) => {
            setShowMessagesModal(open);
            if (!open) setSelectedGuardianForMessages(null);
          }}
          guardianId={selectedGuardianForMessages.id || ''}
          guardianName={selectedGuardianForMessages.name}
          guardianPhone={selectedGuardianForMessages.phone}
          studentNames={selectedGuardianForMessages.studentNames}
          avatarUrl={selectedGuardianForMessages.avatarUrl}
          courseNames={selectedGuardianForMessages.courseNames}
        />
      )}

      {/* Mark as Lead Dialog */}
      <Dialog open={showMarkAsLeadDialog} onOpenChange={setShowMarkAsLeadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Lead</DialogTitle>
            <DialogDescription>
              Selecione o curso de interesse para este contato.
            </DialogDescription>
          </DialogHeader>

          {markAsLeadContact && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10">
                  {markAsLeadContact.profilePicUrl ? (
                    <AvatarImage src={markAsLeadContact.profilePicUrl} alt="Contact" />
                  ) : null}
                  <AvatarFallback>
                    {(markAsLeadContact.pushName || markAsLeadContact.name || 'C')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {markAsLeadContact.pushName || markAsLeadContact.name || formatPhone(markAsLeadContact.phone)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPhone(markAsLeadContact.phone)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Curso de Interesse *</Label>
                <Select value={leadCourseId} onValueChange={setLeadCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.filter(c => c.is_active).map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowMarkAsLeadDialog(false);
                setMarkAsLeadContact(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmMarkAsLead} 
              disabled={isCreatingLead || !leadCourseId}
            >
              {isCreatingLead ? 'Criando...' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
