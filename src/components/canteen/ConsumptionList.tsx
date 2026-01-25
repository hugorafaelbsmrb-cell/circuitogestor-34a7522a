import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, UtensilsCrossed, Calendar } from 'lucide-react';

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

      <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Período: {format(start, "dd/MM", { locale: ptBR })} a {format(end, "dd/MM", { locale: ptBR })}
          </p>
          <p className="text-sm text-muted-foreground">
            {filteredConsumptions.length} consumos registrados
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-primary">{formatPrice(totalValue)}</p>
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
            <Card key={consumption.id}>
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
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatPrice(consumption.total_price)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(consumption.consumed_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
