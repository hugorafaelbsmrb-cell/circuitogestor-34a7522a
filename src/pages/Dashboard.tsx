import { Users, GraduationCap, BookOpen, FileText, TrendingUp, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { useSchool } from '@/contexts/SchoolContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WhatsAppTemplateSelector from '@/components/whatsapp/WhatsAppTemplateSelector';

export default function Dashboard() {
  const { students, courses, classGroups, enrollments, payments, guardians } = useSchool();

  const activeEnrollments = enrollments.filter(e => e.status === 'active').length;
  const totalSlots = classGroups.reduce((acc, cg) => acc + cg.max_students, 0);
  const usedSlots = classGroups.reduce((acc, cg) => acc + cg.current_students, 0);
  const occupancyRate = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  // Get payments due in next 48 hours
  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  
  const paymentsDueIn48h = payments.filter(payment => {
    if (payment.status !== 'PENDING' && payment.status !== 'pending') return false;
    const dueDate = new Date(payment.due_date);
    return dueDate >= now && dueDate <= in48Hours;
  });

  // Get overdue payments
  const overduePayments = payments.filter(payment => {
    const pendingStatuses = ['PENDING', 'pending', 'OVERDUE', 'overdue'];
    if (!pendingStatuses.includes(payment.status)) return false;
    const dueDate = new Date(payment.due_date);
    return dueDate < now;
  });

  const getGuardian = (guardianId: string) => guardians.find(g => g.id === guardianId);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do sistema escolar</p>
        </div>
        <Link to="/matricula">
          <Button className="gap-2">
            <Users className="w-4 h-4" />
            Nova Matrícula
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Alunos Matriculados"
          value={students.length}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Cursos Ativos"
          value={courses.length}
          icon={BookOpen}
        />
        <StatCard
          title="Turmas"
          value={classGroups.length}
          icon={GraduationCap}
          description={`${occupancyRate}% de ocupação`}
        />
        <StatCard
          title="Matrículas Ativas"
          value={activeEnrollments}
          icon={FileText}
          trend={{ value: 8, isPositive: true }}
        />
      </div>

      {/* Alerts Section */}
      {(paymentsDueIn48h.length > 0 || overduePayments.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Payments due in 48h */}
          {paymentsDueIn48h.length > 0 && (
            <div className="bg-warning/10 rounded-xl border border-warning/20 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  <h2 className="text-lg font-semibold text-foreground">Vence em 48h</h2>
                </div>
                <Badge className="bg-warning/20 text-warning border-warning/30">
                  {paymentsDueIn48h.length} boletos
                </Badge>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {paymentsDueIn48h.slice(0, 5).map((payment) => {
                  const guardian = getGuardian(payment.guardian_id);
                  return (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{guardian?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">
                          Vence: {new Date(payment.due_date).toLocaleDateString('pt-BR')} - {payment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                      {guardian && (
                        <WhatsAppTemplateSelector
                          phone={guardian.phone}
                          guardianId={guardian.id}
                          variables={{
                            nome_responsavel: guardian.name,
                          }}
                          buttonVariant="ghost"
                          buttonSize="icon"
                          showLabel={false}
                        />
                      )}
                    </div>
                  );
                })}
                {paymentsDueIn48h.length > 5 && (
                  <Link to="/carnes" className="block text-center text-sm text-warning hover:underline mt-2">
                    Ver todos ({paymentsDueIn48h.length})
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Overdue payments */}
          {overduePayments.length > 0 && (
            <div className="bg-destructive/10 rounded-xl border border-destructive/20 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h2 className="text-lg font-semibold text-foreground">Boletos em Atraso</h2>
                </div>
                <Badge variant="destructive">
                  {overduePayments.length} boletos
                </Badge>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {overduePayments.slice(0, 5).map((payment) => {
                  const guardian = getGuardian(payment.guardian_id);
                  const daysOverdue = Math.floor((now.getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{guardian?.name || 'N/A'}</p>
                        <p className="text-sm text-destructive">
                          {daysOverdue} dias de atraso - {payment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                      {guardian && (
                        <WhatsAppTemplateSelector
                          phone={guardian.phone}
                          guardianId={guardian.id}
                          variables={{
                            nome_responsavel: guardian.name,
                          }}
                          buttonVariant="ghost"
                          buttonSize="icon"
                          showLabel={false}
                        />
                      )}
                    </div>
                  );
                })}
                {overduePayments.length > 5 && (
                  <Link to="/financeiro" className="block text-center text-sm text-destructive hover:underline mt-2">
                    Ver todos ({overduePayments.length})
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Turmas com Vagas</h2>
            <Link to="/turmas" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-4">
            {classGroups.filter(cg => cg.current_students < cg.max_students).slice(0, 5).map((classGroup) => {
              const course = courses.find(c => c.id === classGroup.course_id);
              const availableSlots = classGroup.max_students - classGroup.current_students;
              return (
                <div key={classGroup.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{classGroup.name}</p>
                    <p className="text-sm text-muted-foreground">{course?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-success">{availableSlots} vagas</p>
                    <p className="text-xs text-muted-foreground">{classGroup.current_students}/{classGroup.max_students} alunos</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Ações Rápidas</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/matricula" className="p-4 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors group">
              <Users className="w-8 h-8 text-primary mb-3" />
              <p className="font-medium text-foreground">Nova Matrícula</p>
              <p className="text-sm text-muted-foreground">Matricular novo aluno</p>
            </Link>
            <Link to="/alunos" className="p-4 bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors group">
              <TrendingUp className="w-8 h-8 text-accent mb-3" />
              <p className="font-medium text-foreground">Ver Alunos</p>
              <p className="text-sm text-muted-foreground">Lista de alunos</p>
            </Link>
            <Link to="/cursos" className="p-4 bg-success/10 rounded-lg hover:bg-success/20 transition-colors group">
              <BookOpen className="w-8 h-8 text-success mb-3" />
              <p className="font-medium text-foreground">Cursos</p>
              <p className="text-sm text-muted-foreground">Gerenciar cursos</p>
            </Link>
            <Link to="/horarios" className="p-4 bg-warning/10 rounded-lg hover:bg-warning/20 transition-colors group">
              <Calendar className="w-8 h-8 text-warning mb-3" />
              <p className="font-medium text-foreground">Horários</p>
              <p className="text-sm text-muted-foreground">Ver horários</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
