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
import { Search, UtensilsCrossed, Calendar, Trash2, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
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

  const handlePrintPDF = () => {
    if (filteredConsumptions.length === 0) {
      toast.error('Nenhum consumo para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const getCategoryEmoji = (category: string) => {
      switch (category) {
        case 'lanche': return '🥪';
        case 'bebida': return '🧃';
        case 'doce': return '🍬';
        default: return '📦';
      }
    };

    const getCategoryLabel = (category: string) => {
      switch (category) {
        case 'lanche': return 'Lanche';
        case 'bebida': return 'Bebida';
        case 'doce': return 'Doce';
        default: return 'Outros';
      }
    };

    const tableRows = filteredConsumptions.map(c => `
      <tr>
        <td>${c.student?.name || '-'}</td>
        <td>
          <span class="category-badge">
            ${getCategoryEmoji(c.product?.category || 'outros')} ${getCategoryLabel(c.product?.category || 'outros')}
          </span>
        </td>
        <td>${c.product?.name || '-'}</td>
        <td class="text-center">${c.quantity}</td>
        <td class="text-right">${formatPrice(c.unit_price)}</td>
        <td class="text-right font-semibold">${formatPrice(c.total_price)}</td>
        <td class="text-center">${format(new Date(c.consumed_at), 'dd/MM HH:mm')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Consumos - Cantina</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            background: white;
            padding: 10px;
            font-size: 10px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 10px;
            border-bottom: 2px solid #ea580c;
            margin-bottom: 15px;
          }
          .header-left h1 {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
          }
          .header-left p {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .header-right {
            text-align: right;
          }
          .header-right .date {
            font-size: 9px;
            color: #64748b;
          }
          .summary-box {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .summary-item {
            text-align: center;
          }
          .summary-label {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .summary-value {
            font-size: 14px;
            font-weight: 700;
            color: #1e293b;
            margin-top: 2px;
          }
          .summary-value.highlight {
            color: #ea580c;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background: #1e293b;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          th:first-child { border-radius: 4px 0 0 0; }
          th:last-child { border-radius: 0 4px 0 0; }
          td {
            padding: 6px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 9px;
          }
          tr:nth-child(even) { background: #f8fafc; }
          tr:hover { background: #fef3e7; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-semibold { font-weight: 600; }
          .category-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            background: #f1f5f9;
            font-size: 8px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #64748b;
          }
          .total-row {
            background: #fef3e7 !important;
            font-weight: 700;
          }
          .total-row td {
            border-top: 2px solid #ea580c;
            padding: 10px 6px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>🍽️ Relatório de Consumos - Cantina</h1>
            <p>Período: ${format(start, "dd/MM/yyyy", { locale: ptBR })} a ${format(end, "dd/MM/yyyy", { locale: ptBR })}</p>
          </div>
          <div class="header-right">
            <div class="date">Gerado em ${currentDate}</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-item">
            <div class="summary-label">Total de Registros</div>
            <div class="summary-value">${filteredConsumptions.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Alunos Atendidos</div>
            <div class="summary-value">${new Set(filteredConsumptions.map(c => c.student?.id)).size}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Itens Consumidos</div>
            <div class="summary-value">${filteredConsumptions.reduce((sum, c) => sum + c.quantity, 0)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Valor Total</div>
            <div class="summary-value highlight">${formatPrice(totalValue)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Categoria</th>
              <th>Produto</th>
              <th class="text-center">Qtd</th>
              <th class="text-right">Unit.</th>
              <th class="text-right">Total</th>
              <th class="text-center">Data/Hora</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td colspan="3">TOTAL GERAL</td>
              <td class="text-center">${filteredConsumptions.reduce((sum, c) => sum + c.quantity, 0)}</td>
              <td></td>
              <td class="text-right">${formatPrice(totalValue)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <span>Sistema de Gestão Escolar - Módulo Cantina</span>
          <span>Página 1 de 1</span>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
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
          <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir PDF
          </Button>
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
