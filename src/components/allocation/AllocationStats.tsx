import { Users, Sun, Sunset, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StudentAllocationRow, GroupedCourseData } from './types';

interface AllocationStatsProps {
  filteredData: StudentAllocationRow[];
  groupedData: Record<string, GroupedCourseData>;
}

export function AllocationStats({ filteredData, groupedData }: AllocationStatsProps) {
  const uniqueStudents = [...new Set(filteredData.map(r => r.studentId))].length;
  const morningCount = filteredData.filter(r => r.shift === 'morning').length;
  const afternoonCount = filteredData.filter(r => r.shift === 'afternoon').length;
  const coursesCount = Object.keys(groupedData).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{uniqueStudents}</p>
              <p className="text-xs text-muted-foreground">Alunos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{morningCount}</p>
              <p className="text-xs text-muted-foreground">Matutino</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Sunset className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{afternoonCount}</p>
              <p className="text-xs text-muted-foreground">Vespertino</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{coursesCount}</p>
              <p className="text-xs text-muted-foreground">Cursos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
