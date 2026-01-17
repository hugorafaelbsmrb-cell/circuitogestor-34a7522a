import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Settings2, Save, X } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  depreciation_rate: number | null;
  useful_life_years: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

interface CategoryConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryConfigModal({ open, onOpenChange }: CategoryConfigModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    depreciation_rate: '',
    useful_life_years: '',
    is_active: true
  });
  
  const queryClient = useQueryClient();
  const { profile } = useAuthContext();
  const isAdmin = profile?.role === 'admin';

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['asset_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as AssetCategory[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<AssetCategory, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('asset_categories')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset_categories'] });
      toast.success('Categoria criada com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar categoria: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<AssetCategory> & { id: string }) => {
      const { error } = await supabase
        .from('asset_categories')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset_categories'] });
      toast.success('Categoria atualizada!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('asset_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset_categories'] });
      toast.success('Categoria excluída!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      depreciation_rate: '',
      useful_life_years: '',
      is_active: true
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (category: AssetCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
      depreciation_rate: category.depreciation_rate?.toString() || '',
      useful_life_years: category.useful_life_years?.toString() || '',
      is_active: category.is_active ?? true
    });
    setIsAdding(false);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      depreciation_rate: formData.depreciation_rate ? parseFloat(formData.depreciation_rate) : null,
      useful_life_years: formData.useful_life_years ? parseInt(formData.useful_life_years) : null,
      is_active: formData.is_active
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Deseja excluir a categoria "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configurar Categorias de Ativos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Add/Edit Form */}
          {(isAdding || editingId) && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium">
                {editingId ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cat-name">Nome *</Label>
                  <Input
                    id="cat-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da categoria"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-desc">Descrição</Label>
                  <Input
                    id="cat-desc"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cat-dep">Taxa Depreciação (%)</Label>
                  <Input
                    id="cat-dep"
                    type="number"
                    step="0.01"
                    value={formData.depreciation_rate}
                    onChange={(e) => setFormData({ ...formData, depreciation_rate: e.target.value })}
                    placeholder="Ex: 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-life">Vida Útil (anos)</Label>
                  <Input
                    id="cat-life"
                    type="number"
                    value={formData.useful_life_years}
                    onChange={(e) => setFormData({ ...formData, useful_life_years: e.target.value })}
                    placeholder="Ex: 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <span className="text-sm">{formData.is_active ? 'Ativa' : 'Inativa'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={resetForm}>
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {editingId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </div>
          )}

          {/* Add Button */}
          {!isAdding && !editingId && (
            <Button variant="outline" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          )}

          {/* Categories Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Depreciação</TableHead>
                  <TableHead className="text-center">Vida Útil</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma categoria cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {category.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {category.depreciation_rate ? `${category.depreciation_rate}%` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {category.useful_life_years ? `${category.useful_life_years} anos` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={category.is_active ? 'default' : 'secondary'}>
                          {category.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                            disabled={editingId === category.id}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(category.id, category.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
