import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StudentSearchInput } from '@/components/canteen/StudentSearchInput';
import { ProductSelector } from '@/components/canteen/ProductSelector';
import { CartSummary } from '@/components/canteen/CartSummary';
import { UtensilsCrossed, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSystemBranding } from '@/hooks/useSystemBranding';

interface Student {
  id: string;
  name: string;
  guardian_name?: string;
  guardian_phone?: string;
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

// Map JS day (0=Sun) to Portuguese day name used in schedules
const getDayOfWeekName = (): string => {
  const dayMap: Record<number, string> = {
    0: '', // Domingo - sem aula
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
  };
  return dayMap[new Date().getDay()] || '';
};

export default function CanteenPublic() {
  const { branding } = useSystemBranding();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const todayDay = useMemo(() => getDayOfWeekName(), []);

  // Fetch students with active enrollments for today
  const { data: students = [] } = useQuery({
    queryKey: ['canteen-students', todayDay],
    queryFn: async () => {
      if (!todayDay) {
        return []; // No classes on Sunday
      }

      // Get schedules for today
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('id')
        .eq('day_of_week', todayDay);

      if (schedulesError) throw schedulesError;
      
      const scheduleIds = schedulesData?.map(s => s.id) || [];
      
      if (scheduleIds.length === 0) {
        return [];
      }

      // Get class_groups with those schedules
      const { data: classGroupsData, error: classGroupsError } = await supabase
        .from('class_groups')
        .select('id')
        .in('schedule_id', scheduleIds)
        .eq('is_active', true);

      if (classGroupsError) throw classGroupsError;
      
      const classGroupIds = classGroupsData?.map(cg => cg.id) || [];
      
      if (classGroupIds.length === 0) {
        return [];
      }

      // Get enrollments in those class_groups
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('student_id')
        .in('class_group_id', classGroupIds)
        .eq('status', 'active');

      if (enrollmentsError) throw enrollmentsError;
      
      const studentIds = [...new Set(enrollmentsData?.map(e => e.student_id) || [])];
      
      if (studentIds.length === 0) {
        return [];
      }

      // Get students with guardian info
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          guardian:guardians(name, phone)
        `)
        .in('id', studentIds)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data.map(s => ({
        id: s.id,
        name: s.name,
        guardian_name: (s.guardian as any)?.name,
        guardian_phone: (s.guardian as any)?.phone
      })) as Student[];
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
      const response = await supabase.functions.invoke('canteen-register', {
        body: {
          student_id: selectedStudent.id,
          items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            total_price: item.product.price * item.quantity
          }))
        }
      });

      if (response.error) throw response.error;

      setShowSuccess(true);
      setCart([]);
      setSelectedStudent(null);

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
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
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
        {/* Student Search */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            1. Selecione o Aluno
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
            2. Adicione os Itens
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
            3. Confirme o Pedido
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
