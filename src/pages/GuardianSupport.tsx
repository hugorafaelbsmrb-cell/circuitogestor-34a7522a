import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Filter, 
  User, 
  Clock, 
  GripVertical,
  Phone,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  waiting_response: { label: 'Aguardando Resposta', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  completed: { label: 'Concluído', color: 'bg-green-500/10 text-green-600 border-green-200' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
};

const STATUSES: Array<SupportTicket['status']> = ['pending', 'in_progress', 'waiting_response', 'completed'];

export default function GuardianSupport() {
  const { guardians, courses, students, enrollments, classGroups } = useSchool();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);

  // Form state
  const [formGuardian, setFormGuardian] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPriority, setFormPriority] = useState<SupportTicket['priority']>('normal');
  const [formCourse, setFormCourse] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTickets();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('guardian_support_tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guardian_support_tickets' },
        () => loadTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('guardian_support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast({
        title: 'Erro ao carregar tickets',
        description: 'Não foi possível carregar os atendimentos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get first name
  const getFirstName = (fullName: string): string => {
    return fullName.trim().split(' ')[0] || fullName;
  };

  // Get guardian's associated courses
  const getGuardianCourses = (guardianId: string): string[] => {
    const guardianStudents = students.filter(s => s.guardian_id === guardianId);
    const courseIds = new Set<string>();
    
    guardianStudents.forEach(student => {
      const studentEnrollments = enrollments.filter(e => e.student_id === student.id && e.status === 'active');
      studentEnrollments.forEach(enrollment => {
        const classGroup = classGroups.find(cg => cg.id === enrollment.class_group_id);
        if (classGroup) {
          courseIds.add(classGroup.course_id);
        }
      });
    });
    
    return Array.from(courseIds);
  };

  // Filter tickets by course
  const filteredTickets = useMemo(() => {
    if (selectedCourse === 'all') return tickets;
    return tickets.filter(t => t.course_id === selectedCourse);
  }, [tickets, selectedCourse]);

  // Group tickets by status
  const ticketsByStatus = useMemo(() => {
    const grouped: Record<SupportTicket['status'], SupportTicket[]> = {
      pending: [],
      in_progress: [],
      waiting_response: [],
      completed: [],
    };

    filteredTickets.forEach(ticket => {
      grouped[ticket.status].push(ticket);
    });

    return grouped;
  }, [filteredTickets]);

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
          course_id: formCourse || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Atendimento criado',
        description: 'O ticket foi adicionado ao Kanban.',
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
        course_id: formCourse || null,
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

  const handleStatusChange = async (ticketId: string, newStatus: SupportTicket['status']) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('guardian_support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Erro ao mover',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
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
    setFormCourse(ticket.course_id || '');
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormGuardian('');
    setFormSubject('');
    setFormNotes('');
    setFormPriority('normal');
    setFormCourse('');
  };

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggedTicket(ticketId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: SupportTicket['status']) => {
    e.preventDefault();
    if (draggedTicket) {
      handleStatusChange(draggedTicket, status);
      setDraggedTicket(null);
    }
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const getGuardianInfo = (guardianId: string) => {
    const guardian = guardians.find(g => g.id === guardianId);
    if (!guardian) return { name: 'Desconhecido', phone: '' };
    return { name: getFirstName(guardian.name), phone: guardian.phone };
  };

  const getCourseName = (courseId: string | null) => {
    if (!courseId) return null;
    return courses.find(c => c.id === courseId)?.name || null;
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
          <p className="text-muted-foreground">Kanban de acompanhamento de comunicações</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cursos</SelectItem>
              {courses.filter(c => c.is_active).map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Atendimento
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map((status) => (
          <div
            key={status}
            className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className={`rounded-t-lg px-4 py-3 ${STATUS_CONFIG[status].color} border`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{STATUS_CONFIG[status].label}</h3>
                <Badge variant="secondary" className="bg-background">
                  {ticketsByStatus[status].length}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 border-x border-b rounded-b-lg bg-muted/30">
              <div className="p-2 space-y-2">
                {ticketsByStatus[status].map((ticket) => {
                  const guardianInfo = getGuardianInfo(ticket.guardian_id);
                  const courseName = getCourseName(ticket.course_id);

                  return (
                    <Card
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                            <User className="h-4 w-4" />
                            <span className="font-medium text-foreground text-sm">
                              {guardianInfo.name}
                            </span>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openWhatsApp(guardianInfo.phone)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
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

                        <p className="text-sm font-medium mt-2 line-clamp-2">
                          {ticket.subject}
                        </p>

                        {ticket.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {ticket.notes}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge className={PRIORITY_CONFIG[ticket.priority].color} variant="outline">
                            {PRIORITY_CONFIG[ticket.priority].label}
                          </Badge>
                          {courseName && (
                            <Badge variant="outline" className="text-xs">
                              {courseName}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ticket.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {ticketsByStatus[status].length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum atendimento
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Atendimento</DialogTitle>
            <DialogDescription>
              Crie um ticket para acompanhar a comunicação com o responsável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                    <SelectItem value="">Nenhum</SelectItem>
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTicket} disabled={isSaving}>
              {isSaving ? 'Criando...' : 'Criar Atendimento'}
            </Button>
          </DialogFooter>
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
                value={getGuardianInfo(formGuardian).name}
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
                    <SelectItem value="">Nenhum</SelectItem>
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
    </div>
  );
}
