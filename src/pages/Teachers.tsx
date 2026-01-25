import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, User, Phone, Mail, GraduationCap } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  class_group_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface ClassGroup {
  id: string;
  name: string;
  course_name: string;
}

export default function Teachers() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    class_group_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
        .order('name');

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // Load class groups with course names (filter for Reforço)
      const { data: groupsData, error: groupsError } = await supabase
        .from('class_groups')
        .select(`
          id,
          name,
          courses!inner (name)
        `)
        .eq('is_active', true)
        .order('name');

      if (groupsError) throw groupsError;

      // Filter for Reforço Escolar groups
      const reforcoGroups = (groupsData || [])
        .filter((g: any) => 
          g.courses?.name?.toLowerCase().includes('reforço') ||
          g.courses?.name?.toLowerCase().includes('reforco')
        )
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          course_name: g.courses?.name || '',
        }));

      setClassGroups(reforcoGroups);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os professores.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (teacher?: Teacher) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setFormData({
        name: teacher.name,
        phone: teacher.phone,
        email: teacher.email || '',
        class_group_id: teacher.class_group_id || '',
      });
    } else {
      setEditingTeacher(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        class_group_id: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e telefone são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      const phoneWithCode = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      const teacherData = {
        name: formData.name.trim(),
        phone: phoneWithCode,
        email: formData.email.trim() || null,
        class_group_id: formData.class_group_id || null,
      };

      if (editingTeacher) {
        const { error } = await supabase
          .from('teachers')
          .update(teacherData)
          .eq('id', editingTeacher.id);

        if (error) throw error;
        toast({ title: 'Professor atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('teachers')
          .insert(teacherData);

        if (error) throw error;
        toast({ title: 'Professor cadastrado com sucesso!' });
      }

      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving teacher:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o professor.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`Deseja realmente excluir ${teacher.name}?`)) return;

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacher.id);

      if (error) throw error;
      toast({ title: 'Professor excluído com sucesso!' });
      loadData();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o professor.',
        variant: 'destructive',
      });
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const getClassGroupName = (classGroupId: string | null) => {
    if (!classGroupId) return null;
    const group = classGroups.find(g => g.id === classGroupId);
    return group?.name;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Professores</h1>
            <p className="text-muted-foreground">
              Gerencie os professores do Reforço Escolar para receber os roteiros de atividades
            </p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Professor
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Lista de Professores
            </CardTitle>
            <CardDescription>
              Os roteiros de atividades enviados pelos pais serão encaminhados automaticamente para o professor da sala
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum professor cadastrado</p>
                <p className="text-sm">Cadastre um professor para receber os roteiros</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {formatPhone(teacher.phone)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {teacher.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {teacher.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getClassGroupName(teacher.class_group_id) ? (
                          <Badge variant="secondary">
                            {getClassGroupName(teacher.class_group_id)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Não atribuída</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={teacher.is_active ? 'default' : 'outline'}>
                          {teacher.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(teacher)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(teacher)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTeacher ? 'Editar Professor' : 'Novo Professor'}
              </DialogTitle>
              <DialogDescription>
                {editingTeacher 
                  ? 'Atualize os dados do professor'
                  : 'Cadastre um novo professor para receber os roteiros de atividades'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo do professor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (WhatsApp) *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(94) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="professor@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_group">Turma (Reforço Escolar)</Label>
                <Select
                  value={formData.class_group_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, class_group_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {classGroups.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhuma turma de Reforço encontrada
                      </SelectItem>
                    ) : (
                      classGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {classGroups.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre turmas do curso "Reforço Escolar" primeiro
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTeacher ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
