import { GraduationCap, Users } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { Progress } from '@/components/ui/progress';

export default function Classes() {
  const { classGroups, getCourseById, getScheduleById } = useSchool();

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Turmas</h1>
        <p className="page-subtitle">Visualize e gerencie as turmas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classGroups.map((classGroup) => {
          const course = getCourseById(classGroup.courseId);
          const schedule = getScheduleById(classGroup.scheduleId);
          const occupancyPercent = (classGroup.currentStudents / classGroup.maxStudents) * 100;
          const availableSlots = classGroup.maxStudents - classGroup.currentStudents;

          return (
            <div key={classGroup.id} className="bg-card rounded-xl border border-border/50 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  availableSlots > 5 ? 'bg-success/10 text-success' :
                  availableSlots > 0 ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {availableSlots > 0 ? `${availableSlots} vagas` : 'Lotada'}
                </span>
              </div>

              <h3 className="font-semibold text-foreground mb-1">{classGroup.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{course?.name}</p>

              {schedule && (
                <div className="bg-secondary/30 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-foreground">{schedule.dayOfWeek}</p>
                  <p className="text-sm text-muted-foreground">
                    {schedule.startTime} às {schedule.endTime}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Alunos
                  </span>
                  <span className="font-medium text-foreground">
                    {classGroup.currentStudents}/{classGroup.maxStudents}
                  </span>
                </div>
                <Progress value={occupancyPercent} className="h-2" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
