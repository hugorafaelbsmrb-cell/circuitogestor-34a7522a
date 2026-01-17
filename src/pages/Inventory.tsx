import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, FileText, Edit, Trash2, Package, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InventoryReportModal } from '@/components/inventory/InventoryReportModal';
import { CategoryConfigModal } from '@/components/inventory/CategoryConfigModal';
import { useAuthContext } from '@/contexts/AuthContext';

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  acquisition_date: string;
  acquisition_value: number;
  current_value: number | null;
  location: string | null;
  condition: string;
  status: string;
  depreciation_rate: number | null;
  useful_life_years: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  depreciation_rate: number | null;
  useful_life_years: number | null;
  is_active: boolean | null;
}

const conditions = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'poor', label: 'Ruim' },
  { value: 'unusable', label: 'Inutilizável' }
];

const statuses = [
  { value: 'active', label: 'Ativo' },
  { value: 'maintenance', label: 'Em Manutenção' },
  { value: 'disposed', label: 'Baixado' },
  { value: 'transferred', label: 'Transferido' }
];

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCategoryConfigOpen, setIsCategoryConfigOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const queryClient = useQueryClient();
  const { profile } = useAuthContext();
  const isAdmin = profile?.role === 'admin';

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    acquisition_date: '',
    acquisition_value: '',
    current_value: '',
    location: '',
    condition: 'good',
    status: 'active',
    depreciation_rate: '',
    useful_life_years: '',
    notes: ''
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as AssetCategory[];
    }
  });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['fixed_assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FixedAsset[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('fixed_assets')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_assets'] });
      toast.success('Ativo cadastrado com sucesso!');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar ativo: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<FixedAsset> & { id: string }) => {
      const { error } = await supabase
        .from('fixed_assets')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_assets'] });
      toast.success('Ativo atualizado com sucesso!');
      resetForm();
      setIsDialogOpen(false);
      setEditingAsset(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar ativo: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fixed_assets')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_assets'] });
      toast.success('Ativo excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir ativo: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: '',
      acquisition_date: '',
      acquisition_value: '',
      current_value: '',
      location: '',
      condition: 'good',
      status: 'active',
      depreciation_rate: '',
      useful_life_years: '',
      notes: ''
    });
    setEditingAsset(null);
  };

  const handleEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormData({
      code: asset.code,
      name: asset.name,
      description: asset.description || '',
      category: asset.category,
      acquisition_date: asset.acquisition_date,
      acquisition_value: asset.acquisition_value.toString(),
      current_value: asset.current_value?.toString() || '',
      location: asset.location || '',
      condition: asset.condition,
      status: asset.status,
      depreciation_rate: asset.depreciation_rate?.toString() || '',
      useful_life_years: asset.useful_life_years?.toString() || '',
      notes: asset.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      code: formData.code,
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      acquisition_date: formData.acquisition_date,
      acquisition_value: parseFloat(formData.acquisition_value),
      current_value: formData.current_value ? parseFloat(formData.current_value) : null,
      location: formData.location || null,
      condition: formData.condition,
      status: formData.status,
      depreciation_rate: formData.depreciation_rate ? parseFloat(formData.depreciation_rate) : null,
      useful_life_years: formData.useful_life_years ? parseInt(formData.useful_life_years) : null,
      notes: formData.notes || null
    };

    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.code.toLowerCase().includes(search.toLowerCase()) ||
      (asset.description?.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalValue = assets.reduce((sum, asset) => sum + (asset.current_value || asset.acquisition_value), 0);
  const activeAssets = assets.filter(a => a.status === 'active').length;

  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      regular: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-orange-100 text-orange-800',
      unusable: 'bg-red-100 text-red-800'
    };
    return colors[condition] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      disposed: 'bg-red-100 text-red-800',
      transferred: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getConditionLabel = (value: string) => conditions.find(c => c.value === value)?.label || value;
  const getStatusLabel = (value: string) => statuses.find(s => s.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventário de Ativos</h1>
          <p className="text-muted-foreground">Gestão de ativos imobilizados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCategoryConfigOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Categorias
          </Button>
          <Button variant="outline" onClick={() => setIsReportOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Gerar Relatório
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Ativo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAsset ? 'Editar Ativo' : 'Cadastrar Novo Ativo'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                      placeholder="Ex: MOB-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Nome do ativo"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição detalhada do ativo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Localização</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Ex: Sala 101"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="acquisition_date">Data de Aquisição *</Label>
                    <Input
                      id="acquisition_date"
                      type="date"
                      value={formData.acquisition_date}
                      onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acquisition_value">Valor de Aquisição (R$) *</Label>
                    <Input
                      id="acquisition_value"
                      type="number"
                      step="0.01"
                      value={formData.acquisition_value}
                      onChange={(e) => setFormData({ ...formData, acquisition_value: e.target.value })}
                      required
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_value">Valor Atual (R$)</Label>
                    <Input
                      id="current_value"
                      type="number"
                      step="0.01"
                      value={formData.current_value}
                      onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depreciation_rate">Taxa de Depreciação (%)</Label>
                    <Input
                      id="depreciation_rate"
                      type="number"
                      step="0.01"
                      value={formData.depreciation_rate}
                      onChange={(e) => setFormData({ ...formData, depreciation_rate: e.target.value })}
                      placeholder="Ex: 10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="useful_life_years">Vida Útil (anos)</Label>
                    <Input
                      id="useful_life_years"
                      type="number"
                      value={formData.useful_life_years}
                      onChange={(e) => setFormData({ ...formData, useful_life_years: e.target.value })}
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition">Condição *</Label>
                    <Select
                      value={formData.condition}
                      onValueChange={(value) => setFormData({ ...formData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditions.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações adicionais"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingAsset ? 'Salvar Alterações' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeAssets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(assets.map(a => a.category)).size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por código, nome ou descrição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum ativo encontrado</h3>
              <p className="text-muted-foreground">Comece cadastrando um novo ativo imobilizado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Valor Atual</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono font-medium">{asset.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        {asset.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">{asset.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{asset.category}</TableCell>
                    <TableCell>{asset.location || '-'}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                        .format(asset.current_value || asset.acquisition_value)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getConditionColor(asset.condition)}>
                        {getConditionLabel(asset.condition)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(asset.status)}>
                        {getStatusLabel(asset.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(asset)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Deseja realmente excluir este ativo?')) {
                                deleteMutation.mutate(asset.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InventoryReportModal
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        assets={filteredAssets}
      />

      <CategoryConfigModal
        open={isCategoryConfigOpen}
        onOpenChange={setIsCategoryConfigOpen}
      />
    </div>
  );
}
