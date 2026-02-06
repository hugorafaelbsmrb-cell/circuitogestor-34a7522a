import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Clock, AlertTriangle, Sun, Moon, Sunset, Cake } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';

export function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuthContext();
  const { students, enrollments, payments, isLoading } = useSchool();

  useEffect(() => {
    // Check if popup was already shown in this session
    const popupShown = sessionStorage.getItem('welcomePopupShown');
    // Only show popup after data is loaded
    if (!popupShown && profile && !isLoading && students.length >= 0) {
      setIsOpen(true);
      sessionStorage.setItem('welcomePopupShown', 'true');
    }
  }, [profile, isLoading, students]);

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

  // Get this month's birthdays
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  
  const birthdayStudents = students
    .filter(student => {
      if (!student.birth_date || !student.is_active) return false;
      const birthDate = new Date(student.birth_date);
      return birthDate.getMonth() + 1 === currentMonth;
    })
    .sort((a, b) => {
      const dayA = new Date(a.birth_date).getDate();
      const dayB = new Date(b.birth_date).getDate();
      return dayA - dayB;
    });

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

          {birthdayStudents.length > 0 && (
            <div className="w-full mb-6 p-4 bg-pink-500/10 rounded-xl">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Cake className="w-5 h-5 text-pink-500" />
                <span className="font-semibold text-foreground">
                  🎂 Aniversariantes do Mês
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {birthdayStudents.slice(0, 10).map(student => {
                  const birthDate = new Date(student.birth_date);
                  const birthDay = birthDate.getDate();
                  const age = today.getFullYear() - birthDate.getFullYear();
                  const isToday = birthDay === todayDay;
                  return (
                    <div key={student.id} className={`text-sm ${isToday ? 'bg-pink-500/20 rounded px-2 py-1' : ''}`}>
                      <span className="text-muted-foreground">{birthDay.toString().padStart(2, '0')}/</span>
                      <span className={`font-medium ${isToday ? 'text-pink-600' : 'text-foreground'}`}>
                        {student.name}
                      </span>
                      <span className="ml-1 text-muted-foreground">({age} anos)</span>
                      {isToday && <span className="ml-1">🎉</span>}
                    </div>
                  );
                })}
                {birthdayStudents.length > 10 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    +{birthdayStudents.length - 10} outros aniversariantes
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={() => setIsOpen(false)} className="w-full">
            Começar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
