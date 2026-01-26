import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, User, Phone, Mail, GraduationCap, Key, Eye, EyeOff, Printer, Copy, Check, BookOpen, TrendingUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import StudentReportsTab from '@/components/teachers/StudentReportsTab';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  class_group_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeacherCredential {
  id: string;
  teacher_id: string | null;
  email: string;
  password: string;
  matricula: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  teacher?: Teacher;
}

interface TeacherTrainingProgress {
  id: string;
  teacher_id: string | null;
  teacher_credential_id: string | null;
  track_name: string;
  current_module: string | null;
  current_lesson: string | null;
  completed_lessons: number;
  total_lessons: number;
  completion_percentage: number;
  last_sync_at: string | null;
  teacher?: Teacher;
  credential?: TeacherCredential;
}

interface ClassGroup {
  id: string;
  name: string;
  course_name: string;
}

export default function Teachers() {
  const { toast } = useToast();
  const { branding } = useSystemBranding();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [credentials, setCredentials] = useState<TeacherCredential[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<TeacherTrainingProgress[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const [credentialForm, setCredentialForm] = useState({
    teacher_id: '',
    email: '',
    password: '',
    matricula: '',
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

      // Load credentials with teacher info
      const { data: credentialsData, error: credentialsError } = await supabase
        .from('teacher_credentials')
        .select(`
          *,
          teacher:teachers(*)
        `)
        .order('created_at', { ascending: false });

      if (credentialsError) throw credentialsError;
      setCredentials(credentialsData || []);

      // Load training progress with teacher and credential info
      const { data: trainingData, error: trainingError } = await supabase
        .from('teacher_training_progress')
        .select(`
          *,
          teacher:teachers(*),
          credential:teacher_credentials(*)
        `)
        .order('track_name');

      if (trainingError) {
        console.error('Error loading training progress:', trainingError);
      } else {
        setTrainingProgress(trainingData || []);
      }

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
      });
    } else {
      setEditingTeacher(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenCredentialModal = (teacher?: Teacher) => {
    if (teacher) {
      // Generate credentials based on teacher
      const generatedEmail = generateTeacherEmail(teacher.name);
      const generatedPassword = generateTeacherPassword(teacher.name);
      const generatedMatricula = generateMatricula();

      setCredentialForm({
        teacher_id: teacher.id,
        email: generatedEmail,
        password: generatedPassword,
        matricula: generatedMatricula,
      });
    } else {
      setCredentialForm({
        teacher_id: '',
        email: '',
        password: '',
        matricula: generateMatricula(),
      });
    }
    setIsCredentialModalOpen(true);
  };

  const generateTeacherEmail = (fullName: string): string => {
    const normalized = fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const nameParts = normalized.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return `professor@circuitokids.com.br`;
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    return lastName 
      ? `${firstName}.${lastName}@circuitokids.com.br`
      : `${firstName}@circuitokids.com.br`;
  };

  const generateTeacherPassword = (name: string): string => {
    const firstName = name.split(' ')[0].toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const firstThree = firstName.substring(0, 3);
    const year = new Date().getFullYear();
    return `${firstThree}${year}`;
  };

  const generateMatricula = (): string => {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PROF${year}${random}`;
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

  const handleSaveCredential = async () => {
    if (!credentialForm.email.trim() || !credentialForm.password.trim() || !credentialForm.matricula.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Email, senha e matrícula são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('teacher_credentials')
        .insert({
          teacher_id: credentialForm.teacher_id || null,
          email: credentialForm.email.trim().toLowerCase(),
          password: credentialForm.password.trim(),
          matricula: credentialForm.matricula.trim(),
          is_active: true,
        });

      if (error) throw error;
      toast({ title: 'Credencial criada com sucesso!' });
      setIsCredentialModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving credential:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message?.includes('unique') 
          ? 'Email ou matrícula já cadastrados.' 
          : 'Não foi possível salvar a credencial.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCredential = async (credential: TeacherCredential) => {
    if (!confirm(`Deseja realmente excluir a credencial de ${credential.teacher?.name || credential.email}?`)) return;

    try {
      const { error } = await supabase
        .from('teacher_credentials')
        .delete()
        .eq('id', credential.id);

      if (error) throw error;
      toast({ title: 'Credencial excluída com sucesso!' });
      loadData();
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a credencial.',
        variant: 'destructive',
      });
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

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const printCredential = (credential: TeacherCredential) => {
    const teacherName = credential.teacher?.name || 'Professor';
    
    const printContent = `
      <html>
        <head>
          <title>Credenciais - ${teacherName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .card { border: 2px solid #333; border-radius: 8px; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .header p { margin: 5px 0; color: #666; font-size: 12px; }
            .field { margin: 10px 0; }
            .field label { font-weight: bold; display: block; margin-bottom: 4px; color: #333; }
            .field span { font-size: 16px; }
            .url { background: #f0f0f0; padding: 8px; border-radius: 4px; text-align: center; margin-top: 15px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>${branding.name || 'Sistema Escolar'}</h1>
              <p>Credenciais de Acesso - Professor</p>
            </div>
            <div class="field">
              <label>Professor:</label>
              <span>${teacherName}</span>
            </div>
            <div class="field">
              <label>Matrícula:</label>
              <span>${credential.matricula}</span>
            </div>
            <div class="field">
              <label>Email:</label>
              <span>${credential.email}</span>
            </div>
            <div class="field">
              <label>Senha:</label>
              <span>${credential.password}</span>
            </div>
            <div class="url">
              <strong>Acesse:</strong> ${window.location.origin}/professor-login
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
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

  const teachersWithoutCredentials = teachers.filter(
    t => !credentials.some(c => c.teacher_id === t.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Professores</h1>
          <p className="text-muted-foreground">
            Gerencie professores e credenciais de acesso ao portal externo
          </p>
        </div>
      </div>

      <Tabs defaultValue="teachers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="teachers">Professores</TabsTrigger>
          <TabsTrigger value="credentials">Credenciais de Acesso</TabsTrigger>
          <TabsTrigger value="training">Capacitação</TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teachers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Lista de Professores
                </CardTitle>
                <CardDescription>
                  Os roteiros de atividades enviados pelos pais serão encaminhados automaticamente para o professor da sala
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Professor
              </Button>
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
                    {teachers.map((teacher) => {
                      const hasCredentials = credentials.some(c => c.teacher_id === teacher.id);
                      return (
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
                            <div className="flex items-center gap-2">
                              <Badge variant={teacher.is_active ? 'default' : 'outline'}>
                                {teacher.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                              {hasCredentials && (
                                <Badge variant="secondary" className="gap-1">
                                  <Key className="h-3 w-3" />
                                  Login
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!hasCredentials && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenCredentialModal(teacher)}
                                >
                                  <Key className="h-4 w-4 mr-1" />
                                  Gerar Acesso
                                </Button>
                              )}
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
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Credenciais de Acesso
                </CardTitle>
                <CardDescription>
                  Credenciais para acesso ao portal externo em{' '}
                  <code className="bg-muted px-1 rounded">/professor-login</code>
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenCredentialModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Credencial
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : credentials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma credencial cadastrada</p>
                  <p className="text-sm">Gere credenciais para os professores acessarem o portal</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Professor</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((credential) => (
                      <TableRow key={credential.id}>
                        <TableCell className="font-medium">
                          {credential.teacher?.name || <span className="text-muted-foreground">Sem vínculo</span>}
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">{credential.matricula}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{credential.email}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(credential.email, `email-${credential.id}`)}
                            >
                              {copiedId === `email-${credential.id}` ? (
                                <Check className="h-3 w-3 text-primary" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="bg-muted px-2 py-1 rounded text-sm">
                              {showPasswords[credential.id] ? credential.password : '••••••••'}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(credential.id)}
                            >
                              {showPasswords[credential.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(credential.password, `pwd-${credential.id}`)}
                            >
                              {copiedId === `pwd-${credential.id}` ? (
                                <Check className="h-3 w-3 text-primary" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {credential.last_login_at ? (
                            <span className="text-sm">
                              {new Date(credential.last_login_at).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nunca</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={credential.is_active ? 'default' : 'outline'}>
                            {credential.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => printCredential(credential)}
                              title="Imprimir"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCredential(credential)}
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
        </TabsContent>

        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Progresso de Capacitação
              </CardTitle>
              <CardDescription>
                Acompanhe o progresso dos professores nas trilhas de treinamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : trainingProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum progresso de capacitação registrado</p>
                  <p className="text-sm">Os dados serão atualizados automaticamente pelo sistema externo</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Group by teacher */}
                  {(() => {
                    const grouped = trainingProgress.reduce((acc, item) => {
                      const teacherName = item.teacher?.name || item.credential?.email || 'Professor desconhecido';
                      if (!acc[teacherName]) {
                        acc[teacherName] = [];
                      }
                      acc[teacherName].push(item);
                      return acc;
                    }, {} as Record<string, TeacherTrainingProgress[]>);

                    return Object.entries(grouped).map(([teacherName, tracks]) => (
                      <div key={teacherName} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <GraduationCap className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">{teacherName}</h3>
                        </div>
                        <div className="space-y-4">
                          {tracks.map((track) => (
                            <div key={track.id} className="bg-muted/50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{track.track_name}</span>
                                <Badge variant={track.completion_percentage >= 100 ? 'default' : 'secondary'}>
                                  {track.completion_percentage >= 100 ? 'Concluído' : 'Em andamento'}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>
                                    Aulas: {track.completed_lessons}/{track.total_lessons}
                                  </span>
                                  <span>{Number(track.completion_percentage).toFixed(0)}%</span>
                                </div>
                                <Progress value={Number(track.completion_percentage)} className="h-2" />
                                {(track.current_module || track.current_lesson) && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {track.current_module && (
                                      <Badge variant="outline" className="text-xs">
                                        Módulo: {track.current_module}
                                      </Badge>
                                    )}
                                    {track.current_lesson && (
                                      <Badge variant="outline" className="text-xs">
                                        Aula: {track.current_lesson}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                {track.last_sync_at && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Última atualização: {new Date(track.last_sync_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <StudentReportsTab />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Teacher Modal */}
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

      {/* Add Credential Modal */}
      <Dialog open={isCredentialModalOpen} onOpenChange={setIsCredentialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Credencial de Acesso</DialogTitle>
            <DialogDescription>
              Gere credenciais para o professor acessar o portal externo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cred_teacher">Professor</Label>
              <Select
                value={credentialForm.teacher_id}
                onValueChange={(value) => {
                  const selectedTeacher = teachers.find(t => t.id === value);
                  if (selectedTeacher) {
                    setCredentialForm(prev => ({
                      ...prev,
                      teacher_id: value,
                      email: generateTeacherEmail(selectedTeacher.name),
                      password: generateTeacherPassword(selectedTeacher.name),
                    }));
                  } else {
                    setCredentialForm(prev => ({ ...prev, teacher_id: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um professor (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {teachersWithoutCredentials.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Todos os professores já têm credenciais
                    </SelectItem>
                  ) : (
                    teachersWithoutCredentials.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cred_matricula">Matrícula *</Label>
              <Input
                id="cred_matricula"
                value={credentialForm.matricula}
                onChange={(e) => setCredentialForm(prev => ({ ...prev, matricula: e.target.value }))}
                placeholder="PROF2025ABC123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cred_email">Email de Login *</Label>
              <Input
                id="cred_email"
                type="email"
                value={credentialForm.email}
                onChange={(e) => setCredentialForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="professor@circuitokids.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cred_password">Senha *</Label>
              <Input
                id="cred_password"
                value={credentialForm.password}
                onChange={(e) => setCredentialForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="senha123"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCredentialModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCredential} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Credencial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
