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
          // Fetch student name and consumption details
          const { data: consumption } = await supabase
            .from('canteen_consumptions')
            .select(`
              total_price,
              student:students(name)
            `)
            .eq('id', payload.new.id)
            .single();

          if (consumption) {
            const studentName = (consumption.student as any)?.name || 'Aluno';
            const totalPrice = new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(consumption.total_price);

            toast(
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold">🍽️ Consumo Registrado</p>
                  <p className="text-sm text-muted-foreground">
                    {studentName} consumiu {totalPrice}
                  </p>
                </div>
              </div>,
              { duration: 5000 }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
