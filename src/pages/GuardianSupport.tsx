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
  RefreshCw
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
    label: 'Não Cadastrados', 
    color: 'bg-gray-500/10 text-gray-600 border-gray-200',
    icon: <UserX className="h-4 w-4" />,
    description: 'Números sem cadastro'
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
  hasUnreadMessages?: boolean;
}

interface UnknownContact {
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
}

export default function GuardianSupport() {
  const { guardians, courses, students, enrollments, classGroups, refetch } = useSchool();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [unknownMessages, setUnknownMessages] = useState<WhatsAppMessage[]>([]);
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
        const [ticketsResult, messagesResult] = await Promise.all([
        supabase
          .from('guardian_support_tickets')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('whatsapp_messages')
          .select('*')
          .is('guardian_id', null)
          .order('created_at', { ascending: false })
      ]);

      if (ticketsResult.error) throw ticketsResult.error;
      if (messagesResult.error) throw messagesResult.error;

      setTickets((ticketsResult.data || []) as SupportTicket[]);
      setUnknownMessages((messagesResult.data || []) as WhatsAppMessage[]);
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

      // Determine category
      // VIP: more than 1 student OR more than 1 course
      const isVip = studentCount > 1 || courseCount > 1;

      if (isVip) {
        result.vip.push({
          id: guardian.id,
          name: guardian.name,
          phone: guardian.phone,
          avatarUrl: (guardian as { avatar_url?: string | null }).avatar_url,
          category: 'vip',
          studentCount,
          courseCount,
          courseNames,
          tickets: guardianTickets,
        });
      } else if (courseNames.length > 0) {
        // Single course - categorize by course type
        const column = getCourseColumn(courseNames[0]);
        if (column) {
          result[column].push({
            id: guardian.id,
            name: guardian.name,
            phone: guardian.phone,
            avatarUrl: (guardian as { avatar_url?: string | null }).avatar_url,
            category: column,
            studentCount,
            courseCount,
            courseNames,
            tickets: guardianTickets,
          });
        }
      }
    });

    return result;
  }, [guardians, students, enrollments, classGroups, courses, tickets]);

  // Group unknown phone numbers - excluding those that match a registered guardian
  const unknownContacts = useMemo(() => {
    const phoneMap = new Map<string, UnknownContact>();
    
    unknownMessages.forEach(msg => {
      // Verifica se esse telefone corresponde a algum guardian cadastrado
      const matchedGuardian = guardians.find(g => phonesMatch(g.phone, msg.phone));
      if (matchedGuardian) {
        // Este telefone pertence a um guardian cadastrado, não é "desconhecido"
        return;
      }

      const existing = phoneMap.get(msg.phone);
      if (existing) {
        existing.messageCount++;
        if (new Date(msg.created_at) > new Date(existing.lastMessageAt)) {
          existing.lastMessage = msg.message;
          existing.lastMessageAt = msg.created_at;
        }
      } else {
        phoneMap.set(msg.phone, {
          phone: msg.phone,
          lastMessage: msg.message,
          lastMessageAt: msg.created_at,
          messageCount: 1,
        });
      }
    });

    return Array.from(phoneMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [unknownMessages, guardians]);

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
                  {isUnknownColumn && unknownContacts.map((contact) => (
                    <Card key={contact.phone} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <UserX className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {formatPhone(contact.phone)}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => {
                                setSelectedGuardianForMessages({
                                  id: null,
                                  name: formatPhone(contact.phone),
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

                        {/* Ver Mensagens Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 text-xs h-7"
                          onClick={() => {
                            setSelectedGuardianForMessages({
                              id: null,
                              name: formatPhone(contact.phone),
                              phone: contact.phone,
                              studentNames: [],
                            });
                            setShowMessagesModal(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Ver Mensagens
                        </Button>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Guardians in Category */}
                  {!isUnknownColumn && guardiansInColumn.map((guardian) => (
                    <Card key={guardian.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={guardian.avatarUrl || undefined} alt={guardian.name} />
                              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                {guardian.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
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
    </div>
  );
}
