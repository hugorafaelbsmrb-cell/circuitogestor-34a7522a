import { Sun, Sunset, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StudentAllocationRow, ShiftType, DAYS_OF_WEEK, DAY_SHORT_NAMES, DAY_COLORS } from './types';

interface ShiftSectionProps {
  shiftData: Record<string, StudentAllocationRow[]>;
  shiftType: ShiftType;
}

export function ShiftSection({ shiftData, shiftType }: ShiftSectionProps) {
  const hasStudents = Object.values(shiftData).flat().length > 0;
  if (!hasStudents) return null;

  const ShiftIcon = shiftType === 'morning' ? Sun : Sunset;
  const shiftLabel = shiftType === 'morning' ? 'Turno Matutino' : 'Turno Vespertino';
  const shiftTime = shiftType === 'morning' ? '(até 12h)' : '(após 12h)';
  const shiftGradient = shiftType === 'morning' 
    ? 'from-amber-500 to-orange-500' 
    : 'from-indigo-500 to-purple-500';

  return (
    <div className="mb-6">
      <div className={`bg-gradient-to-r ${shiftGradient} text-white px-4 py-2 rounded-t-lg flex items-center gap-2`}>
        <ShiftIcon className="w-4 h-4" />
        <span className="font-medium">{shiftLabel}</span>
        <span className="text-white/80 text-sm">{shiftTime}</span>
        <Badge variant="secondary" className="ml-auto bg-white/20 text-white hover:bg-white/30">
          {Object.values(shiftData).flat().length} alunos
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 border border-t-0 rounded-b-lg overflow-hidden">
        {DAYS_OF_WEEK.map(day => {
          const studentsForDay = shiftData[day] || [];
          const colorClass = DAY_COLORS[day] || 'bg-gray-500';
          
          return (
            <div key={day} className="flex flex-col border-r last:border-r-0">
              <div className={`${colorClass} text-white py-2 px-3 font-medium text-center text-sm`}>
                {DAY_SHORT_NAMES[day]}
                <span className="ml-1 opacity-80">({studentsForDay.length})</span>
              </div>
              
              <div className="flex-1 p-2 min-h-[120px] max-h-[280px] overflow-y-auto bg-muted/30">
                {studentsForDay.length > 0 ? (
                  <div className="space-y-1.5">
                    {studentsForDay
                      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.shortName.localeCompare(b.shortName))
                      .map((student, idx) => (
                        <div 
                          key={`${student.studentId}-${idx}`}
                          className="bg-card rounded border px-2 py-1.5 shadow-sm hover:shadow transition-shadow"
                        >
                          <div className="font-medium text-xs text-foreground truncate" title={student.studentName}>
                            {student.shortName}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{student.startTime} - {student.endTime}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                    -
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
