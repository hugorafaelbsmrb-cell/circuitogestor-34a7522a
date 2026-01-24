import { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Copy, 
  User,
  Trophy,
  Loader2,
  Printer,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';

interface SorobanCredential {
  id: string;
  student_id: string | null;
  enrollment_id: string | null;
  email: string;
  password: string;
  matricula: string;
  soroban_user_id: string | null;
  current_level: number;
  current_module: string | null;
  completion_percentage: number;
  last_sync_at: string | null;
  created_at: string;
  student?: {
    id: string;
    name: string;
    birth_date: string;
    is_active: boolean;
  } | null;
}

export default function SorobanStudents() {
  const { toast } = useToast();
  const { branding } = useSystemBranding();
  const { students } = useSchool();
  const [credentials, setCredentials] = useState<SorobanCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<SorobanCredential | null>(null);
  const [editModal, setEditModal] = useState<SorobanCredential | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [formData, setFormData] = useState({
    matricula: '',
    email: '',
    password: '',
    current_level: 1,
    student_id: '',
  });

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('soroban_credentials')
        .select(`
          *,
          student:students(id, name, birth_date, is_active)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do Soroban.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      const { error } = await supabase
        .from('soroban_credentials')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: 'Credencial excluída',
        description: 'As credenciais do aluno foram removidas.',
      });
      
      await fetchCredentials();
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir as credenciais.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleEdit = async () => {
    if (!editModal) return;
    
    try {
      const { error } = await supabase
        .from('soroban_credentials')
        .update({
          current_level: formData.current_level,
          student_id: formData.student_id || null,
        })
        .eq('id', editModal.id);

      if (error) throw error;

      toast({
        title: 'Credencial atualizada',
        description: 'Os dados foram atualizados com sucesso.',
      });
      
      setEditModal(null);
      await fetchCredentials();
    } catch (error) {
      console.error('Error updating credential:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar os dados.',
        variant: 'destructive',
      });
    }
  };

  const handleAdd = async () => {
    if (!formData.matricula || !formData.email || !formData.password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha matrícula, email e senha.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('soroban_credentials')
        .insert({
          matricula: formData.matricula,
          email: formData.email,
          password: formData.password,
          current_level: formData.current_level,
          student_id: formData.student_id || null,
        });

      if (error) throw error;

      toast({
        title: 'Credencial criada',
        description: 'O aluno foi adicionado com sucesso.',
      });
      
      setAddModal(false);
      setFormData({ matricula: '', email: '', password: '', current_level: 1, student_id: '' });
      await fetchCredentials();
    } catch (error) {
      console.error('Error adding credential:', error);
      toast({
        title: 'Erro ao adicionar',
        description: 'Não foi possível adicionar o aluno.',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (credential: SorobanCredential) => {
    setFormData({
      matricula: credential.matricula,
      email: credential.email,
      password: credential.password,
      current_level: credential.current_level || 1,
      student_id: credential.student_id || '',
    });
    setEditModal(credential);
  };

  const printCredential = (credential: SorobanCredential) => {
    const studentName = credential.student?.name || 'Aluno Soroban';
    
    const printContent = `
      <html>
        <head>
          <title>Credenciais Soroban - ${studentName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .card { border: 2px solid #333; border-radius: 8px; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .header p { margin: 5px 0; color: #666; font-size: 12px; }
            .field { margin: 10px 0; }
            .field label { font-weight: bold; display: block; margin-bottom: 4px; color: #333; }
            .field span { font-size: 16px; }
            .level { background: #f0f0f0; padding: 8px; border-radius: 4px; text-align: center; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>${branding.name || 'Sistema Escolar'}</h1>
              <p>Credenciais de Acesso - Soroban</p>
            </div>
            <div class="field">
              <label>Aluno:</label>
              <span>${studentName}</span>
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
            <div class="level">
              <strong>Nível Atual: ${credential.current_level || 1}</strong>
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

  const printAllCredentials = () => {
    const filtered = filteredCredentials;
    if (filtered.length === 0) {
      toast({
        title: 'Nenhum aluno',
        description: 'Não há alunos para imprimir.',
        variant: 'destructive',
      });
      return;
    }

    const cardsHtml = filtered.map(cred => `
      <div class="card">
        <div class="header">
          <strong>Soroban</strong>
        </div>
        <div class="name">${cred.student?.name || 'Aluno'}</div>
        <div class="field"><span class="label">Matrícula:</span> ${cred.matricula}</div>
        <div class="field"><span class="label">Email:</span> ${cred.email}</div>
        <div class="field"><span class="label">Senha:</span> ${cred.password}</div>
        <div class="level">Nível ${cred.current_level || 1}</div>
      </div>
    `).join('');

    const printContent = `
      <html>
        <head>
          <title>Credenciais Soroban</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 10px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .card { border: 1px solid #333; border-radius: 6px; padding: 12px; font-size: 11px; break-inside: avoid; }
            .header { font-weight: bold; font-size: 12px; margin-bottom: 8px; text-align: center; }
            .name { font-weight: bold; font-size: 13px; margin-bottom: 8px; }
            .field { margin: 4px 0; }
            .label { font-weight: bold; }
            .level { background: #f0f0f0; padding: 4px; border-radius: 4px; text-align: center; margin-top: 8px; font-weight: bold; }
            @media print { .grid { grid-template-columns: repeat(3, 1fr); } }
          </style>
        </head>
        <body>
          <h2 style="text-align: center; margin-bottom: 20px;">Credenciais de Acesso - Soroban</h2>
          <div class="grid">${cardsHtml}</div>
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

  const filteredCredentials = credentials.filter(cred => {
    const searchLower = searchTerm.toLowerCase();
    const studentName = cred.student?.name?.toLowerCase() || '';
    const email = cred.email.toLowerCase();
    const matricula = cred.matricula.toLowerCase();
    
    return studentName.includes(searchLower) || 
           email.includes(searchLower) || 
           matricula.includes(searchLower);
  });

  const getLevelBadgeColor = (level: number) => {
    if (level <= 3) return 'bg-green-100 text-green-800';
    if (level <= 6) return 'bg-blue-100 text-blue-800';
    if (level <= 9) return 'bg-purple-100 text-purple-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alunos Soroban</h1>
          <p className="text-muted-foreground">Gerenciamento de credenciais do sistema Soroban</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printAllCredentials}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Todos
          </Button>
          <Button onClick={() => {
            setFormData({ matricula: '', email: '', password: '', current_level: 1, student_id: '' });
            setAddModal(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Alunos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credentials.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Níveis 1-3</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {credentials.filter(c => (c.current_level || 1) <= 3).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Níveis 4-6</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {credentials.filter(c => (c.current_level || 1) > 3 && (c.current_level || 1) <= 6).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Níveis 7+</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {credentials.filter(c => (c.current_level || 1) > 6).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome, email ou matrícula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchCredentials} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCredentials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum aluno encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Senha</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCredentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{credential.student?.name || 'Sem vínculo'}</p>
                          {credential.student && !credential.student.is_active && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{credential.matricula}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{credential.email}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(credential.email, 'Email')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {visiblePasswords.has(credential.id) ? credential.password : '••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(credential.id)}
                        >
                          {visiblePasswords.has(credential.id) ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(credential.password, 'Senha')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getLevelBadgeColor(credential.current_level || 1)}>
                        <Trophy className="w-3 h-3 mr-1" />
                        Nível {credential.current_level || 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Ações
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Opções</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => printCredential(credential)}>
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimir Credenciais
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(credential)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteConfirm(credential)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Aluno Soroban</DialogTitle>
            <DialogDescription>
              Cadastre as credenciais de acesso para um novo aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula *</Label>
              <Input
                id="matricula"
                value={formData.matricula}
                onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                placeholder="Ex: 2024001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="aluno@circuitokids.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Senha de acesso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Nível Atual</Label>
              <Select
                value={String(formData.current_level)}
                onValueChange={(value) => setFormData({ ...formData, current_level: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <SelectItem key={level} value={String(level)}>
                      Nível {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student">Vincular Aluno (opcional)</Label>
              <Select
                value={formData.student_id}
                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {students.filter(s => s.is_active).map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Aluno Soroban</DialogTitle>
            <DialogDescription>
              Atualize o nível ou vínculo do aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={formData.matricula} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-level">Nível Atual</Label>
              <Select
                value={String(formData.current_level)}
                onValueChange={(value) => setFormData({ ...formData, current_level: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <SelectItem key={level} value={String(level)}>
                      Nível {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student">Vincular Aluno</Label>
              <Select
                value={formData.student_id}
                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {students.filter(s => s.is_active).map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir as credenciais de{' '}
              <strong>{deleteConfirm?.student?.name || deleteConfirm?.matricula}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
