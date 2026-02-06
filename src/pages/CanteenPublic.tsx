import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StudentSearchInput } from '@/components/canteen/StudentSearchInput';
import { ProductSelector } from '@/components/canteen/ProductSelector';
import { CartSummary } from '@/components/canteen/CartSummary';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { UtensilsCrossed, CheckCircle, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StudentSchedule {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface Student {
  id: string;
  name: string;
  guardian_name?: string;
  guardian_phone?: string;
  schedules?: StudentSchedule[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function CanteenPublic() {
  const { branding } = useSystemBranding();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch all active students with their schedules from all enrollments
  const { data: students = [] } = useQuery({
    queryKey: ['canteen-students-all'],
    queryFn: async () => {
      // First get all active students with guardian info
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          guardian:guardians(name, phone)
        `)
        .eq('is_active', true)
        .order('name');

      if (studentsError) throw studentsError;

      // Then get all active enrollments with their class schedules
      // The schedule is linked via class_groups.schedule_id -> schedules.id
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          class_groups!inner(
            is_active,
            schedule_id,
            schedules(
              day_of_week,
              start_time,
              end_time
            )
          )
        `)
        .eq('status', 'active')
        .eq('class_groups.is_active', true);

      if (enrollmentsError) throw enrollmentsError;

      // Day order for sorting (Segunda to Sexta only)
      const dayOrder: Record<string, number> = {
        'Segunda-feira': 1,
        'Terça-feira': 2,
        'Quarta-feira': 3,
        'Quinta-feira': 4,
        'Sexta-feira': 5,
      };

      // Group schedules by student_id
      const schedulesByStudent = new Map<string, StudentSchedule[]>();
      
      enrollmentsData?.forEach(enrollment => {
        const classGroup = enrollment.class_groups as any;
        const schedule = classGroup?.schedules;
        
        // Only include weekdays (Segunda to Sexta)
        if (schedule && schedule.day_of_week && dayOrder[schedule.day_of_week]) {
          const studentSchedules = schedulesByStudent.get(enrollment.student_id) || [];
          
          // Avoid duplicates
          const exists = studentSchedules.some(
            s => s.day_of_week === schedule.day_of_week && 
                 s.start_time === schedule.start_time
          );
          
          if (!exists) {
            studentSchedules.push({
              day_of_week: schedule.day_of_week,
              start_time: schedule.start_time,
              end_time: schedule.end_time
            });
          }
          
          schedulesByStudent.set(enrollment.student_id, studentSchedules);
        }
      });

      // Combine students with their schedules (sorted by day order)
      const studentsWithSchedules = studentsData?.map(student => {
        const schedules = schedulesByStudent.get(student.id) || [];
        // Sort schedules by day order
        schedules.sort((a, b) => (dayOrder[a.day_of_week] || 99) - (dayOrder[b.day_of_week] || 99));
        
        return {
          id: student.id,
          name: student.name,
          guardian_name: (student.guardian as any)?.name,
          guardian_phone: (student.guardian as any)?.phone,
          schedules
        };
      }) || [];

      return studentsWithSchedules as Student[];
    }
  });

  // Fetch active products
  const { data: products = [] } = useQuery({
    queryKey: ['canteen-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canteen_products')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
      
      if (error) throw error;
      return data as Product[];
    }
  });

  const handleAddItem = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleConfirm = async () => {
    if (!selectedStudent || cart.length === 0) return;

    setIsSubmitting(true);
    try {
      // Set time to noon of selected date for backdated entries
      const consumedAt = new Date(selectedDate);
      consumedAt.setHours(12, 0, 0, 0);
      
      const response = await supabase.functions.invoke('canteen-register', {
        body: {
          student_id: selectedStudent.id,
          items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            total_price: item.product.price * item.quantity
          })),
          consumed_at: consumedAt.toISOString()
        }
      });

      if (response.error) throw response.error;

      setShowSuccess(true);
      setCart([]);
      setSelectedStudent(null);
      setSelectedDate(new Date()); // Reset to today

      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error registering consumption:', error);
      toast.error('Erro ao registrar consumo. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Consumo Registrado!
          </h1>
          <p className="text-muted-foreground">
            O lançamento foi salvo com sucesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {branding.logo ? (
            <img 
              src={branding.logo} 
              alt={branding.name} 
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold">Cantina</h1>
            <p className="text-sm opacity-80">{branding.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Date Selector */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            1. Data do Consumo
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Selecione a data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date > new Date() || date < subDays(new Date(), 30)}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          {selectedDate && format(selectedDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Lançamento retroativo para {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        {/* Student Search */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            2. Selecione o Aluno
          </label>
          <StudentSearchInput
            students={students}
            selectedStudent={selectedStudent}
            onSelect={setSelectedStudent}
            onClear={() => setSelectedStudent(null)}
          />
        </div>

        {/* Products */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            3. Adicione os Itens
          </label>
          <ProductSelector
            products={products}
            cart={cart}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
          />
        </div>

        {/* Cart Summary */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            4. Confirme o Pedido
          </label>
          <CartSummary
            cart={cart}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onConfirm={handleConfirm}
            isSubmitting={isSubmitting}
            studentName={selectedStudent?.name || null}
          />
        </div>
      </div>
    </div>
  );
}
