import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Calendar, Users, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ConsumptionGroup {
  guardian_id: string;
  guardian_name: string;
  guardian_phone: string;
  students: {
    student_id: string;
    student_name: string;
    items: {
      product_name: string;
      quantity: number;
      total: number;
    }[];
    subtotal: number;
  }[];
  total: number;
}

export function WeeklySummary() {
  const [weekFilter, setWeekFilter] = useState('current');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

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
      default:
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
    }

    return { start, end };
  };

  const { start, end } = getWeekDates(weekFilter);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['canteen-weekly-summary', weekFilter],
    queryFn: async () => {
      // Fetch consumptions with student and guardian info
      const { data: consumptions, error } = await supabase
        .from('canteen_consumptions')
        .select(`
          id,
          quantity,
          total_price,
          student:students(
            id,
            name,
            guardian:guardians(id, name, phone)
          ),
          product:canteen_products(name)
        `)
        .gte('consumed_at', start.toISOString())
        .lte('consumed_at', end.toISOString());

      if (error) throw error;

      // Group by guardian
      const groupedByGuardian: Record<string, ConsumptionGroup> = {};

      consumptions?.forEach((c: any) => {
        const guardian = c.student?.guardian;
        if (!guardian) return;

        if (!groupedByGuardian[guardian.id]) {
          groupedByGuardian[guardian.id] = {
            guardian_id: guardian.id,
            guardian_name: guardian.name,
            guardian_phone: guardian.phone,
            students: [],
            total: 0
          };
        }

        const group = groupedByGuardian[guardian.id];
        let studentGroup = group.students.find(s => s.student_id === c.student.id);
        
        if (!studentGroup) {
          studentGroup = {
            student_id: c.student.id,
            student_name: c.student.name,
            items: [],
            subtotal: 0
          };
          group.students.push(studentGroup);
        }

        // Aggregate items
        const existingItem = studentGroup.items.find(i => i.product_name === c.product?.name);
        if (existingItem) {
          existingItem.quantity += c.quantity;
          existingItem.total += c.total_price;
        } else {
          studentGroup.items.push({
            product_name: c.product?.name || 'Produto',
            quantity: c.quantity,
            total: c.total_price
          });
        }

        studentGroup.subtotal += c.total_price;
        group.total += c.total_price;
      });

      return Object.values(groupedByGuardian).sort((a, b) => 
        a.guardian_name.localeCompare(b.guardian_name)
      );
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (guardianId: string) => {
      const summary = summaries.find(s => s.guardian_id === guardianId);
      if (!summary) throw new Error('Resumo não encontrado');

      const response = await supabase.functions.invoke('canteen-send-summary', {
        body: {
          guardian_id: guardianId,
          guardian_phone: summary.guardian_phone,
          guardian_name: summary.guardian_name,
          week_start: format(start, 'dd/MM'),
          week_end: format(end, 'dd/MM'),
          students: summary.students,
          total: summary.total
        }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success('Resumo enviado via WhatsApp!');
      setSendingTo(null);
    },
    onError: (error) => {
      console.error('Error sending summary:', error);
      toast.error('Erro ao enviar resumo');
      setSendingTo(null);
    }
  });

  const sendAllMutation = useMutation({
    mutationFn: async () => {
      for (const summary of summaries) {
        await sendMutation.mutateAsync(summary.guardian_id);
      }
    },
    onSuccess: () => {
      toast.success('Todos os resumos foram enviados!');
    }
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const totalGeral = summaries.reduce((sum, s) => sum + s.total, 0);

  if (isLoading) {
    return <div className="text-center py-8">Carregando resumos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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

        {summaries.length > 0 && (
          <Button 
            onClick={() => sendAllMutation.mutate()}
            disabled={sendAllMutation.isPending}
          >
            {sendAllMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Enviar para Todos
          </Button>
        )}
      </div>

      <div className="bg-muted/30 rounded-lg p-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm">
            {format(start, "dd/MM", { locale: ptBR })} a {format(end, "dd/MM", { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm">{summaries.length} responsáveis</span>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm text-muted-foreground">Total Geral</p>
          <p className="text-xl font-bold text-primary">{formatPrice(totalGeral)}</p>
        </div>
      </div>

      {summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum consumo registrado nesta semana.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {summaries.map(summary => (
            <Card key={summary.guardian_id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {summary.guardian_name}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSendingTo(summary.guardian_id);
                      sendMutation.mutate(summary.guardian_id);
                    }}
                    disabled={sendingTo === summary.guardian_id}
                  >
                    {sendingTo === summary.guardian_id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    Enviar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{summary.guardian_phone}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.students.map(student => (
                    <div key={student.student_id} className="bg-muted/30 rounded-lg p-3">
                      <p className="font-medium mb-2">👦 {student.student_name}</p>
                      <div className="space-y-1 text-sm">
                        {student.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-muted-foreground">
                            <span>{item.quantity}x {item.product_name}</span>
                            <span>{formatPrice(item.total)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium pt-1 border-t border-border">
                          <span>Subtotal</span>
                          <span className="text-primary">{formatPrice(student.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(summary.total)}</span>
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
