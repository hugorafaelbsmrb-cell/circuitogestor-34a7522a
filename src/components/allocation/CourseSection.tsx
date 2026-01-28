import { BookOpen, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShiftSection } from './ShiftSection';
import { GroupedCourseData, Teacher, ShiftFilter } from './types';

interface CourseSectionProps {
  courseName: string;
  data: GroupedCourseData;
  teachers: Teacher[];
  shiftFilter: ShiftFilter;
}

export function CourseSection({ courseName, data, teachers, shiftFilter }: CourseSectionProps) {
  const courseTeachers = teachers.filter(t => t.courseId === data.courseId);
  const showMorning = shiftFilter === 'all' || shiftFilter === 'morning';
  const showAfternoon = shiftFilter === 'all' || shiftFilter === 'afternoon';
  
  const uniqueStudentIds = [
    ...new Set([
      ...Object.values(data.morning).flat(),
      ...Object.values(data.afternoon).flat()
    ].map(s => s.studentId))
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{courseName}</CardTitle>
              {courseTeachers.length > 0 && (
                <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {courseTeachers.map(t => t.name).join(', ')}
                </p>
              )}
            </div>
          </div>
          <Badge className="bg-white/20 text-white hover:bg-white/30">
            {uniqueStudentIds.length} alunos
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {showMorning && <ShiftSection shiftData={data.morning} shiftType="morning" />}
        {showAfternoon && <ShiftSection shiftData={data.afternoon} shiftType="afternoon" />}
      </CardContent>
    </Card>
  );
}
