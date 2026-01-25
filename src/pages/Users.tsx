import { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  Search,
  Loader2,
  Shield,
  User,
  Trash2,
  Edit,
  MoreHorizontal,
  Plus,
  Mail,
  Lock,
  Image,
  Settings,
  Upload
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserPermissions {
  dashboard?: boolean;
  enrollment?: boolean;
  students?: boolean;
  guardians?: boolean;
  guardian_support?: boolean;
  leads?: boolean;
  classes?: boolean;
  courses?: boolean;
  schedules?: boolean;
  lms?: boolean;
  soroban?: boolean;
  teachers?: boolean;
  financial?: boolean;
  carnes?: boolean;
  contracts?: boolean;
  discounts?: boolean;
  reports?: boolean;
  whatsapp?: boolean;
  inventory?: boolean;
  contract_config?: boolean;
  users?: boolean;
  settings?: boolean;
  [key: string]: boolean | undefined;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  permissions: UserPermissions | null;
  created_at: string;
  updated_at: string;
}

const moduleLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  enrollment: 'Nova Matrícula',
  students: 'Alunos',
  guardians: 'Responsáveis',
  guardian_support: 'Atendimento aos Pais',
  leads: 'Leads',
  classes: 'Turmas',
  courses: 'Cursos',
  schedules: 'Horários',
  lms: 'Alunos LMS',
  soroban: 'Alunos Soroban',
  teachers: 'Professores (Admin)',
  financial: 'Financeiro',
  carnes: 'Carnês',
  contracts: 'Contratos',
  discounts: 'Descontos',
  reports: 'Relatórios',
  whatsapp: 'Comunicação (Envio em Massa)',
  inventory: 'Patrimônio',
  contract_config: 'Config. Contrato',
  users: 'Usuários (Admin)',
  settings: 'Configurações (Admin)',
};

const defaultPermissions: UserPermissions = {
  dashboard: true,
  enrollment: true,
  students: true,
  guardians: true,
  guardian_support: true,
  leads: true,
  classes: true,
  courses: true,
  schedules: true,
  lms: true,
  soroban: true,
  teachers: false,
  financial: true,
  carnes: true,
  contracts: true,
  discounts: true,
  reports: true,
  whatsapp: false,
  inventory: true,
  contract_config: true,
};

export default function Users() {
  const { toast } = useToast();
  const { profile: currentProfile, signUp } = useAuthContext();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [newRole, setNewRole] = useState<string>('user');
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions>(defaultPermissions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginBackground, setLoginBackground] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'user',
  });

  useEffect(() => {
    fetchProfiles();
    fetchLoginBackground();
  }, []);

  const fetchProfiles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProfiles((data || []) as any as Profile[]);
    }
    setIsLoading(false);
  };

  const fetchLoginBackground = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'login_background')
      .maybeSingle();
    
    if (data?.value) {
      setLoginBackground(data.value);
    }
  };

  const handleEditRole = (user: Profile) => {
    setEditingUser(user);
    setNewRole(user.role);
    setShowEditModal(true);
  };

  const handleEditPermissions = (user: Profile) => {
    setEditingUser(user);
    setEditingPermissions(user.permissions || defaultPermissions);
    setShowPermissionsModal(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', editingUser.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar usuário',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuário atualizado',
        description: 'O perfil foi atualizado com sucesso.',
      });
      fetchProfiles();
      setShowEditModal(false);
      setEditingUser(null);
    }
    
    setIsSubmitting(false);
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ permissions: editingPermissions })
      .eq('id', editingUser.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar permissões',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Permissões atualizadas',
        description: 'As permissões do usuário foram atualizadas.',
      });
      fetchProfiles();
      setShowPermissionsModal(false);
      setEditingUser(null);
    }
    
    setIsSubmitting(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentProfile?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode excluir seu próprio usuário.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro ao excluir usuário',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuário excluído',
        description: 'O usuário foi removido do sistema.',
      });
      fetchProfiles();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.email || !createForm.password || !createForm.fullName) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    if (createForm.password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Use edge function to create user without affecting current session
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          fullName: createForm.fullName,
          role: createForm.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast({
        title: 'Usuário criado',
        description: 'O novo usuário foi cadastrado com sucesso.',
      });
      
      setShowCreateModal(false);
      setCreateForm({ email: '', password: '', fullName: '', role: 'user' });
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setIsSubmitting(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `login-bg-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('login-backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('login-backgrounds')
        .getPublicUrl(fileName);

      setLoginBackground(publicUrl);

      toast({
        title: 'Imagem carregada',
        description: 'A imagem foi enviada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar imagem',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsUploadingImage(false);
  };

  const handleSaveBackground = async () => {
    setIsSubmitting(true);
    
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'login_background')
      .maybeSingle();
    
    if (existing) {
      await supabase
        .from('app_settings')
        .update({ value: loginBackground })
        .eq('key', 'login_background');
    } else {
      await supabase
        .from('app_settings')
        .insert({
          key: 'login_background',
          value: loginBackground,
          description: 'URL da imagem de fundo da tela de login',
          is_secret: false,
        });
    }
    
    toast({
      title: 'Configuração salva',
      description: 'O background do login foi atualizado.',
    });
    
    setShowBackgroundModal(false);
    setIsSubmitting(false);
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = 
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
            <Shield className="w-3 h-3 mr-1" />
            Administrador
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <User className="w-3 h-3 mr-1" />
            Usuário
          </Badge>
        );
    }
  };

  // Check if current user is admin
  if (currentProfile?.role !== 'admin') {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Acesso Negado</h1>
          <p className="page-subtitle">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Gerenciamento de Usuários</h1>
          <p className="page-subtitle">Gerencie os usuários e suas permissões</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBackgroundModal(true)} className="gap-2">
            <Image className="w-4 h-4" />
            Background Login
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="user">Usuários</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : filteredProfiles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {profile.full_name ? (
                          <span className="text-sm font-medium text-primary">
                            {profile.full_name.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <User className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <span>{profile.full_name || 'Sem nome'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.email}
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(profile.role)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(profile.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditRole(profile)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Alterar Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditPermissions(profile)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Gerenciar Módulos
                        </DropdownMenuItem>
                        {profile.id !== currentProfile?.id && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(profile.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum usuário encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca.</p>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Cadastre um novo usuário no sistema
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  placeholder="Nome do usuário"
                  className="pl-10"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  className="pl-10"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select 
                value={createForm.role} 
                onValueChange={(value) => setCreateForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Perfil do Usuário</DialogTitle>
            <DialogDescription>
              Altere o perfil de {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRole} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Módulos</DialogTitle>
            <DialogDescription>
              Defina quais módulos {editingUser?.full_name || editingUser?.email} pode acessar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(moduleLabels).map(([key, label]) => {
                // Hide admin-only modules for non-admin users
                const adminOnlyModules = ['users', 'settings', 'teachers'];
                if (adminOnlyModules.includes(key) && editingUser?.role !== 'admin') {
                  return null;
                }
                
                return (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <Label htmlFor={`perm-${key}`} className="cursor-pointer flex-1">
                      {label}
                    </Label>
                    <Checkbox
                      id={`perm-${key}`}
                      checked={editingPermissions[key as keyof UserPermissions] ?? true}
                      onCheckedChange={(checked) => {
                        setEditingPermissions(prev => ({
                          ...prev,
                          [key]: !!checked
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPermissionsModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : 'Salvar Permissões'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Background Config Modal */}
      <Dialog open={showBackgroundModal} onOpenChange={setShowBackgroundModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Background do Login</DialogTitle>
            <DialogDescription>
              Faça upload de uma imagem local para a tela de login
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Upload Section */}
            <div className="space-y-2">
              <Label>Enviar Imagem</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  id="bg-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => document.getElementById('bg-upload')?.click()}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Selecionar Imagem
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendado: imagens de alta resolução (1920x1080 ou maior). Máximo 5MB.
              </p>
            </div>
            
            {loginBackground && (
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <div className="relative rounded-lg overflow-hidden h-48 bg-secondary">
                  <img 
                    src={loginBackground} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-background/90 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Shield className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium">EduGestor</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  URL: {loginBackground}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowBackgroundModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBackground} disabled={isSubmitting || !loginBackground}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
