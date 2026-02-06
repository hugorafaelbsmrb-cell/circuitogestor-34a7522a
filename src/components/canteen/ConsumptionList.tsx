import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, UtensilsCrossed, Calendar, Trash2, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Consumption {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  consumed_at: string;
  student: {
    id: string;
    name: string;
  };
  product: {
    id: string;
    name: string;
    category: string;
  };
}

export function ConsumptionList() {
  const [search, setSearch] = useState('');
  const [weekFilter, setWeekFilter] = useState('current');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const getWeekDates = (filter: string) => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'last':
        start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case 'last2':
        start = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        end = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        break;
      default: // current
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
    }

    return { start, end };
  };

  const { start, end } = getWeekDates(weekFilter);

  const { data: consumptions = [], isLoading } = useQuery({
    queryKey: ['canteen-consumptions', weekFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canteen_consumptions')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          consumed_at,
          student:students(id, name),
          product:canteen_products(id, name, category)
        `)
        .gte('consumed_at', start.toISOString())
        .lte('consumed_at', end.toISOString())
        .order('consumed_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Consumption[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('canteen_consumptions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-consumptions'] });
      toast.success('Consumo excluído com sucesso!');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao excluir consumo.');
    }
  });

  const filteredConsumptions = consumptions.filter(c =>
    c.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filteredConsumptions.reduce((sum, c) => sum + c.total_price, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDateTime = (date: string) => {
    return format(new Date(date), "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  const handleExportCSV = () => {
    if (filteredConsumptions.length === 0) {
      toast.error('Nenhum consumo para exportar.');
      return;
    }

    const headers = ['Aluno', 'Produto', 'Categoria', 'Quantidade', 'Preço Unit.', 'Total', 'Data/Hora'];
    const rows = filteredConsumptions.map(c => [
      c.student?.name || '',
      c.product?.name || '',
      c.product?.category || '',
      c.quantity.toString(),
      c.unit_price.toFixed(2).replace('.', ','),
      c.total_price.toFixed(2).replace('.', ','),
      format(new Date(c.consumed_at), 'dd/MM/yyyy HH:mm')
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `consumos-cantina-${format(start, 'dd-MM-yyyy')}-a-${format(end, 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Relatório exportado com sucesso!');
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando consumos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por aluno ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Esta semana</SelectItem>
            <SelectItem value="last">Semana passada</SelectItem>
            <SelectItem value="last2">2 semanas atrás</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Período: {format(start, "dd/MM", { locale: ptBR })} a {format(end, "dd/MM", { locale: ptBR })}
          </p>
          <p className="text-sm text-muted-foreground">
            {filteredConsumptions.length} consumos registrados
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Exportar CSV
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-primary">{formatPrice(totalValue)}</p>
          </div>
        </div>
      </div>

      {filteredConsumptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum consumo registrado neste período.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredConsumptions.map(consumption => (
            <Card key={consumption.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">
                      {consumption.product?.category === 'lanche' && '🥪'}
                      {consumption.product?.category === 'bebida' && '🧃'}
                      {consumption.product?.category === 'doce' && '🍬'}
                      {consumption.product?.category === 'outros' && '📦'}
                    </div>
                    <div>
                      <p className="font-medium">{consumption.student?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {consumption.quantity}x {consumption.product?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        {formatPrice(consumption.total_price)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(consumption.consumed_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(consumption.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Consumo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
