import { Users, GraduationCap, BookOpen, FileText, TrendingUp, Calendar } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { useSchool } from '@/contexts/SchoolContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { students, courses, classGroups, enrollments } = useSchool();

  const activeEnrollments = enrollments.filter(e => e.status === 'active').length;
  const totalSlots = classGroups.reduce((acc, cg) => acc + cg.max_students, 0);
  const usedSlots = classGroups.reduce((acc, cg) => acc + cg.current_students, 0);
  const occupancyRate = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

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
