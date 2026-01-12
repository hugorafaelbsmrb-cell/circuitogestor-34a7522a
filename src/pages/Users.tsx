import { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  Search,
  Loader2,
  Shield,
  User,
  Trash2,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function Users() {
  const { toast } = useToast();
  const { profile: currentProfile } = useAuthContext();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newRole, setNewRole] = useState<string>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProfiles();
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
      setProfiles(data || []);
    }
    setIsLoading(false);
  };

  const handleEditRole = (user: Profile) => {
    setEditingUser(user);
    setNewRole(user.role);
    setShowEditModal(true);
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Gerenciamento de Usuários</h1>
          <p className="page-subtitle">Gerencie os usuários e suas permissões</p>
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
    </div>
  );
}
