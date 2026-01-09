import { BookOpen, Clock, DollarSign } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';

export default function Courses() {
  const { courses, classGroups } = useSchool();

  const getClassCount = (courseId: string) => {
    return classGroups.filter(cg => cg.courseId === courseId).length;
  };

  const getTotalStudents = (courseId: string) => {
    return classGroups
      .filter(cg => cg.courseId === courseId)
      .reduce((acc, cg) => acc + cg.currentStudents, 0);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Cursos</h1>
        <p className="page-subtitle">Cursos disponíveis na escola</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => {
          const classCount = getClassCount(course.id);
          const totalStudents = getTotalStudents(course.id);

          return (
            <div key={course.id} className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-2 bg-gradient-to-r from-primary to-accent" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-2">{course.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{course.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Turmas</p>
                    <p className="text-lg font-semibold text-foreground">{classCount}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Alunos</p>
                    <p className="text-lg font-semibold text-foreground">{totalStudents}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary font-semibold">
                    <DollarSign className="w-4 h-4" />
                    <span>{course.price.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
