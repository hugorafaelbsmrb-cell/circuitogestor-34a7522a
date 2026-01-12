import { useState, useEffect } from 'react';
import { 
  Percent, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  DollarSign,
  Tag
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Discount {
  id: string;
  name: string;
  description: string | null;
  type: 'percentage' | 'fixed';
  value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Discounts() {
  const { toast } = useToast();
  
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    is_active: true,
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('name');
    
    if (error) {
      toast({
        title: 'Erro ao carregar descontos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setDiscounts((data || []) as Discount[]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.value) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e valor são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    const value = parseFloat(form.value);
    if (isNaN(value) || value <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'O valor deve ser um número positivo.',
        variant: 'destructive',
      });
      return;
    }

    if (form.type === 'percentage' && value > 100) {
      toast({
        title: 'Valor inválido',
        description: 'O percentual não pode ser maior que 100%.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const discountData = {
      name: form.name,
      description: form.description || null,
      type: form.type,
      value,
      is_active: form.is_active,
    };

    if (editingDiscount) {
      const { error } = await supabase
        .from('discounts')
        .update(discountData)
        .eq('id', editingDiscount.id);

      if (error) {
        toast({
          title: 'Erro ao atualizar desconto',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Desconto atualizado',
          description: 'O desconto foi atualizado com sucesso.',
        });
        fetchDiscounts();
        handleCloseModal();
      }
    } else {
      const { error } = await supabase
        .from('discounts')
        .insert(discountData);

      if (error) {
        toast({
          title: 'Erro ao criar desconto',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Desconto criado',
          description: 'O desconto foi criado com sucesso.',
        });
        fetchDiscounts();
        handleCloseModal();
      }
    }

    setIsSubmitting(false);
  };

  const handleEdit = (discount: Discount) => {
    setEditingDiscount(discount);
    setForm({
      name: discount.name,
      description: discount.description || '',
      type: discount.type,
      value: discount.value.toString(),
      is_active: discount.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este desconto?')) return;

    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir desconto',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Desconto excluído',
        description: 'O desconto foi removido.',
      });
      fetchDiscounts();
    }
  };

  const handleToggleActive = async (discount: Discount) => {
    const { error } = await supabase
      .from('discounts')
      .update({ is_active: !discount.is_active })
      .eq('id', discount.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar desconto',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      fetchDiscounts();
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDiscount(null);
    setForm({
      name: '',
      description: '',
      type: 'percentage',
      value: '',
      is_active: true,
    });
  };

  const formatValue = (discount: Discount) => {
    if (discount.type === 'percentage') {
      return `${discount.value}%`;
    }
    return `R$ ${discount.value.toFixed(2)}`;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Descontos</h1>
          <p className="page-subtitle">Gerencie os tipos de descontos disponíveis</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Desconto
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : discounts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      {discount.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {discount.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {discount.type === 'percentage' ? (
                        <><Percent className="w-3 h-3 mr-1" />Percentual</>
                      ) : (
                        <><DollarSign className="w-3 h-3 mr-1" />Fixo</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatValue(discount)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={discount.is_active}
                      onCheckedChange={() => handleToggleActive(discount)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(discount)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(discount.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <Percent className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum desconto cadastrado</h3>
            <p className="text-muted-foreground mb-4">Crie descontos para usar nas matrículas</p>
            <Button onClick={() => setShowModal(true)}>Criar Desconto</Button>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDiscount ? 'Editar Desconto' : 'Novo Desconto'}</DialogTitle>
            <DialogDescription>
              {editingDiscount ? 'Atualize as informações do desconto.' : 'Crie um novo tipo de desconto.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Desconto Irmão"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição do desconto..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select 
                  value={form.type} 
                  onValueChange={(value: 'percentage' | 'fixed') => setForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Valor *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {form.type === 'percentage' ? '%' : 'R$'}
                  </span>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.type === 'percentage' ? '100' : undefined}
                    value={form.value}
                    onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                    className="pl-10"
                    placeholder={form.type === 'percentage' ? '10' : '50.00'}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Ativo</Label>
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
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
                ) : editingDiscount ? 'Atualizar' : 'Criar Desconto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
