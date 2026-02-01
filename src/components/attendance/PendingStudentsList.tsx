import { useState, useMemo } from 'react';
import { Search, Clock, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StudentCheckInCard } from './StudentCheckInCard';

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_group_id: string | null;
  expected_time: string;
  checked_in_at: string | null;
  status: 'pending' | 'present' | 'absent' | 'late';
  student?: {
    id: string;
    name: string;
  };
  class_group?: {
    id: string;
    name: string;
    course?: {
      id: string;
      name: string;
    };
  };
}

interface StudentForAttendance {
  id: string;
  name: string;
  enrollment_id: string;
  class_group_id: string;
  class_group_name: string;
  course_name: string;
  expected_time: string;
}

interface PendingStudentsListProps {
  records: AttendanceRecord[];
  studentsForToday: StudentForAttendance[];
  onCheckIn: (studentId: string, classGroupId: string) => Promise<boolean>;
  onUndo?: (recordId: string) => Promise<boolean>;
  showAllStatuses?: boolean;
  isLoading?: boolean;
}

export function PendingStudentsList({
  records,
  studentsForToday,
  onCheckIn,
  onUndo,
  showAllStatuses = false,
  isLoading,
}: PendingStudentsListProps) {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  // Get unique courses and times
  const courses = useMemo(() => {
    const courseSet = new Set<string>();
    studentsForToday.forEach(s => courseSet.add(s.course_name));
    return Array.from(courseSet).sort();
  }, [studentsForToday]);

  const times = useMemo(() => {
    const timeSet = new Set<string>();
    studentsForToday.forEach(s => timeSet.add(s.expected_time));
    return Array.from(timeSet).sort();
  }, [studentsForToday]);

  // Create a map of existing records
  const recordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach(r => {
      if (r.student_id && r.class_group_id) {
        map.set(`${r.student_id}-${r.class_group_id}`, r);
      }
    });
    return map;
  }, [records]);

  // Merge students with their attendance records
  const studentsWithStatus = useMemo(() => {
    return studentsForToday.map(student => {
      const record = recordsMap.get(`${student.id}-${student.class_group_id}`);
      return {
        ...student,
        status: record?.status || 'pending',
        checkedInAt: record?.checked_in_at || null,
        recordId: record?.id || null,
      };
    });
  }, [studentsForToday, recordsMap]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return studentsWithStatus.filter(student => {
      // Search filter
      if (search && !student.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      // Course filter
      if (courseFilter !== 'all' && student.course_name !== courseFilter) {
        return false;
      }
      
      // Time filter
      if (timeFilter !== 'all' && student.expected_time !== timeFilter) {
        return false;
      }
      
      // Status filter (only show pending by default)
      if (!showAllStatuses && student.status !== 'pending') {
        return false;
      }
      
      return true;
    });
  }, [studentsWithStatus, search, courseFilter, timeFilter, showAllStatuses]);

  // Group by time
  const groupedByTime = useMemo(() => {
    const groups: Record<string, typeof filteredStudents> = {};
    filteredStudents.forEach(student => {
      if (!groups[student.expected_time]) {
        groups[student.expected_time] = [];
      }
      groups[student.expected_time].push(student);
    });
    return groups;
  }, [filteredStudents]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cursos</SelectItem>
            {courses.map(course => (
              <SelectItem key={course} value={course}>{course}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <Clock className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Horário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {times.map(time => (
              <SelectItem key={time} value={time}>{formatTime(time)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search || courseFilter !== 'all' || timeFilter !== 'all' ? (
            <p>Nenhum aluno encontrado com os filtros selecionados.</p>
          ) : (
            <p>
              {showAllStatuses 
                ? 'Nenhum registro de presença para hoje.'
                : 'Todos os alunos já tiveram a presença registrada! 🎉'}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByTime)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([time, students]) => (
              <div key={time}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="font-mono">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(time)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {students.length} aluno{students.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="grid gap-2">
                  {students.map(student => (
                    <StudentCheckInCard
                      key={`${student.id}-${student.class_group_id}`}
                      studentId={student.id}
                      studentName={student.name}
                      courseName={student.course_name}
                      classGroupName={student.class_group_name}
                      expectedTime={student.expected_time}
                      status={student.status as 'pending' | 'present' | 'absent' | 'late'}
                      checkedInAt={student.checkedInAt}
                      recordId={student.recordId || undefined}
                      classGroupId={student.class_group_id}
                      onCheckIn={onCheckIn}
                      onUndo={onUndo}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
