import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Clock, AlertTriangle, Sun, Moon, Sunset } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';

export function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuthContext();
  const { students, enrollments, payments } = useSchool();

  useEffect(() => {
    // Check if popup was already shown in this session
    const popupShown = sessionStorage.getItem('welcomePopupShown');
    if (!popupShown && profile) {
      setIsOpen(true);
      sessionStorage.setItem('welcomePopupShown', 'true');
    }
  }, [profile]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { text: 'Bom dia', icon: Sun };
    } else if (hour >= 12 && hour < 18) {
      return { text: 'Boa tarde', icon: Sunset };
    } else {
      return { text: 'Boa noite', icon: Moon };
    }
  };

  const getUserFirstName = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ')[0];
    }
    return 'Usuário';
  };

  // Calculate stats
  const activeEnrollments = enrollments.filter(e => e.status === 'active').length;

  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  
  const paymentsDueIn48h = payments.filter(payment => {
    if (payment.status !== 'PENDING' && payment.status !== 'pending') return false;
    const dueDate = new Date(payment.due_date);
    return dueDate >= now && dueDate <= in48Hours;
  }).length;

  const overduePayments = payments.filter(payment => {
    const pendingStatuses = ['PENDING', 'pending', 'OVERDUE', 'overdue'];
    if (!pendingStatuses.includes(payment.status)) return false;
    const dueDate = new Date(payment.due_date);
    return dueDate < now;
  }).length;

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <GreetingIcon className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {greeting.text}, {getUserFirstName()}! 👋
          </h2>
          
          <p className="text-muted-foreground mb-6">
            Aqui está um resumo rápido do seu sistema
          </p>

          <div className="grid grid-cols-3 gap-4 w-full mb-6">
            <div className="flex flex-col items-center p-4 bg-primary/10 rounded-xl">
              <Users className="w-6 h-6 text-primary mb-2" />
              <span className="text-2xl font-bold text-foreground">{activeEnrollments}</span>
              <span className="text-xs text-muted-foreground text-center">Alunos Matriculados</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-warning/10 rounded-xl">
              <Clock className="w-6 h-6 text-warning mb-2" />
              <span className="text-2xl font-bold text-foreground">{paymentsDueIn48h}</span>
              <span className="text-xs text-muted-foreground text-center">Vencem em 48h</span>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-destructive/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-destructive mb-2" />
              <span className="text-2xl font-bold text-foreground">{overduePayments}</span>
              <span className="text-xs text-muted-foreground text-center">Boletos Vencidos</span>
            </div>
          </div>

          <Button onClick={() => setIsOpen(false)} className="w-full">
            Começar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
