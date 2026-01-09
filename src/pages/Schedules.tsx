import { Calendar, Clock } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';

export default function Schedules() {
  const { schedules, getCourseById } = useSchool();

  const groupedByDay = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.dayOfWeek]) {
      acc[schedule.dayOfWeek] = [];
    }
    acc[schedule.dayOfWeek].push(schedule);
    return acc;
  }, {} as Record<string, typeof schedules>);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Horários</h1>
        <p className="page-subtitle">Grade de horários das turmas</p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByDay).map(([day, daySchedules]) => (
          <div key={day} className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="bg-primary/5 px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{day}</h3>
              </div>
            </div>
            <div className="divide-y divide-border">
              {daySchedules.map((schedule) => {
                const course = getCourseById(schedule.courseId);
                return (
                  <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{course?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {schedule.startTime} às {schedule.endTime}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        {schedule.availableSlots} vagas
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
