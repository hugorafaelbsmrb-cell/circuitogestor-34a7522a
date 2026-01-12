import { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Calendar,
  User,
  MessageSquare,
  ArrowRight,
  Loader2,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { useNavigate } from 'react-router-dom';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  status: string;
  notes: string | null;
  student_name: string | null;
  student_birth_date: string | null;
  interested_course_id: string | null;
  assigned_to: string | null;
  converted_at: string | null;
  enrollment_id: string | null;
  created_at: string;
  updated_at: string;
}

const statusOptions = [
  { value: 'new', label: 'Novo', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { value: 'contacted', label: 'Contatado', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  { value: 'interested', label: 'Interessado', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { value: 'scheduled', label: 'Agendado', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { value: 'converted', label: 'Convertido', color: 'bg-success/10 text-success border-success/20' },
  { value: 'lost', label: 'Perdido', color: 'bg-destructive/10 text-destructive border-destructive/20' },
];

const sourceOptions = [
  { value: 'website', label: 'Website' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Telefone' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'referral', label: 'Indicação' },
  { value: 'other', label: 'Outro' },
];

export default function Leads() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { courses, getCourseById } = useSchool();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'website',
    status: 'new',
    notes: '',
    student_name: '',
    student_birth_date: '',
    interested_course_id: '',
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({
        title: 'Erro ao carregar leads',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setLeads(data || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.phone) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e telefone são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const leadData = {
      name: form.name,
      email: form.email || null,
      phone: form.phone,
      source: form.source,
      status: form.status,
      notes: form.notes || null,
      student_name: form.student_name || null,
      student_birth_date: form.student_birth_date || null,
      interested_course_id: form.interested_course_id || null,
    };

    if (editingLead) {
      const { error } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', editingLead.id);

      if (error) {
        toast({
          title: 'Erro ao atualizar lead',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Lead atualizado',
          description: 'Os dados do lead foram atualizados.',
        });
        fetchLeads();
        handleCloseModal();
      }
    } else {
      const { error } = await supabase
        .from('leads')
        .insert(leadData);

      if (error) {
        toast({
          title: 'Erro ao criar lead',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Lead criado',
          description: 'O lead foi adicionado com sucesso.',
        });
        fetchLeads();
        handleCloseModal();
      }
    }

    setIsSubmitting(false);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      notes: lead.notes || '',
      student_name: lead.student_name || '',
      student_birth_date: lead.student_birth_date || '',
      interested_course_id: lead.interested_course_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir lead',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Lead excluído',
        description: 'O lead foi removido.',
      });
      fetchLeads();
    }
  };

  const handleConvert = (lead: Lead) => {
    // Navigate to enrollment page with lead data
    navigate(`/matricula?leadId=${lead.id}&name=${encodeURIComponent(lead.student_name || lead.name)}&phone=${encodeURIComponent(lead.phone)}&email=${encodeURIComponent(lead.email || '')}`);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLead(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      source: 'website',
      status: 'new',
      notes: '',
      student_name: '',
      student_birth_date: '',
      interested_course_id: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(o => o.value === status);
    return option ? (
      <Badge className={option.color}>{option.label}</Badge>
    ) : (
      <Badge variant="outline">{status}</Badge>
    );
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    interested: leads.filter(l => l.status === 'interested').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Gerencie seus leads e acompanhe o funil de vendas</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Lead
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <AlertCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.new}</p>
                <p className="text-sm text-muted-foreground">Novos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.interested}</p>
                <p className="text-sm text-muted-foreground">Interessados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.converted}</p>
                <p className="text-sm text-muted-foreground">Convertidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : filteredLeads.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredLeads.map((lead) => {
              const course = lead.interested_course_id ? getCourseById(lead.interested_course_id) : null;
              
              return (
                <div key={lead.id} className="p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{lead.name}</p>
                          {getStatusBadge(lead.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </span>
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {(lead.student_name || course) && (
                          <div className="mt-2 text-sm">
                            {lead.student_name && (
                              <span className="text-muted-foreground">Aluno: <span className="text-foreground">{lead.student_name}</span></span>
                            )}
                            {course && (
                              <span className="text-muted-foreground ml-3">Interesse: <span className="text-foreground">{course.name}</span></span>
                            )}
                          </div>
                        )}
                        {lead.notes && (
                          <p className="mt-2 text-sm text-muted-foreground flex items-start gap-1">
                            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                            {lead.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {lead.status !== 'converted' && lead.status !== 'lost' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleConvert(lead)}
                          className="text-success hover:text-success hover:bg-success/10"
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Matricular
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(lead)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(lead.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Nenhum lead encontrado' : 'Nenhum lead cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Comece adicionando seu primeiro lead'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setShowModal(true)}>Adicionar Lead</Button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
            <DialogDescription>
              {editingLead ? 'Atualize as informações do lead.' : 'Adicione um novo lead ao sistema.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Responsável *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student_name">Nome do Aluno</Label>
                <Input
                  id="student_name"
                  value={form.student_name}
                  onChange={(e) => setForm(prev => ({ ...prev, student_name: e.target.value }))}
                  placeholder="Nome do aluno"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student_birth_date">Data de Nascimento</Label>
                <Input
                  id="student_birth_date"
                  type="date"
                  value={form.student_birth_date}
                  onChange={(e) => setForm(prev => ({ ...prev, student_birth_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Origem</Label>
                <Select value={form.source} onValueChange={(value) => setForm(prev => ({ ...prev, source: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interested_course_id">Curso de Interesse</Label>
              <Select 
                value={form.interested_course_id || "none"} 
                onValueChange={(value) => setForm(prev => ({ ...prev, interested_course_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {courses.filter(c => c.is_active).map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Anotações sobre o lead..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingLead ? 'Atualizar' : 'Criar Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
