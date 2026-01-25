import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UtensilsCrossed } from 'lucide-react';

export function CanteenNotificationListener() {
  useEffect(() => {
    const channel = supabase
      .channel('canteen-consumptions-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'canteen_consumptions'
        },
        async (payload) => {
          const newRecord = payload.new as { id: string; student_id: string; total_price: number };
          
          // Fetch student name
          const { data: student } = await supabase
            .from('students')
            .select('name')
            .eq('id', newRecord.student_id)
            .single();

          // Get today's total for this student
          const today = new Date().toISOString().split('T')[0];
          const { data: todayConsumptions } = await supabase
            .from('canteen_consumptions')
            .select('total_price')
            .eq('student_id', newRecord.student_id)
            .gte('consumed_at', `${today}T00:00:00`)
            .lte('consumed_at', `${today}T23:59:59`);

          const dailyTotal = todayConsumptions?.reduce((sum, c) => sum + c.total_price, 0) || 0;

          const studentName = student?.name || 'Aluno';
          const consumptionPrice = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(newRecord.total_price);
          
          const dailyTotalFormatted = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(dailyTotal);

          toast(
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold">🍽️ Consumo Registrado</p>
                <p className="text-sm text-muted-foreground">
                  {studentName} • {consumptionPrice}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total do dia: <span className="font-medium text-foreground">{dailyTotalFormatted}</span>
                </p>
              </div>
            </div>,
            { duration: 5000 }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
