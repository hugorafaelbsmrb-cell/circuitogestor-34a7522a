import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Search, 
  Printer,
  Download,
  Loader2,
  Calendar,
  Clock,
  BookOpen,
  Filter,
  Sun,
  Sunset,
  GraduationCap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface StudentAllocationRow {
  studentId: string;
  studentName: string;
  shortName: string;
  birthDate: string;
  guardianName: string;
  guardianPhone: string;
  courseName: string;
  courseId: string;
  className: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enrollmentStatus: string;
  shift: 'morning' | 'afternoon';
}

interface Teacher {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
}

const DAYS_OF_WEEK = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

const DAY_COLORS: Record<string, string> = {
  'Segunda-feira': 'bg-blue-500',
  'Terça-feira': 'bg-green-500',
  'Quarta-feira': 'bg-purple-500',
  'Quinta-feira': 'bg-orange-500',
  'Sexta-feira': 'bg-pink-500',
};

const DAY_SHORT_NAMES: Record<string, string> = {
  'Segunda-feira': 'Segunda',
  'Terça-feira': 'Terça',
  'Quarta-feira': 'Quarta',
  'Quinta-feira': 'Quinta',
  'Sexta-feira': 'Sexta',
};

// Função para determinar o turno baseado no horário
const getShift = (startTime: string): 'morning' | 'afternoon' => {
  const hour = parseInt(startTime.split(':')[0], 10);
  return hour < 12 ? 'morning' : 'afternoon';
};

// Função para extrair primeiro e segundo nome
const getShortName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || fullName;
};

export default function StudentAllocation() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch teachers
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-allocation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          id,
          name,
          course_id,
          course:courses(name)
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      
      return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        courseId: t.course_id,
        courseName: t.course?.name || 'Sem curso',
      })) as Teacher[];
    }
  });

  // Fetch all allocation data
  const { data: allocationData = [], isLoading } = useQuery({
    queryKey: ['student-allocation'],
    queryFn: async () => {
      const { data: enrollmentSchedulesData, error: esError } = await supabase
        .from('enrollment_schedules')
        .select(`
          id,
          enrollment:enrollments(
            id,
            status,
            student:students(
              id,
              name,
              birth_date,
              is_active,
              guardian:guardians(name, phone)
            )
          ),
          class_group:class_groups(
            id,
            name,
            is_active,
            course:courses(id, name),
            schedule:schedules(day_of_week, start_time, end_time)
          )
        `);
      
      const filteredSchedulesData = enrollmentSchedulesData?.filter((es: any) => {
        const enrollment = es.enrollment;
        const student = enrollment?.student;
        const classGroup = es.class_group;
        
        return enrollment?.status === 'active' && 
               student?.is_active === true && 
               classGroup?.is_active === true;
      }) || [];

      const rows: StudentAllocationRow[] = [];

      if (!esError && filteredSchedulesData.length > 0) {
        filteredSchedulesData.forEach((es: any) => {
          const enrollment = es.enrollment;
          const student = enrollment?.student;
          const classGroup = es.class_group;
          const course = classGroup?.course;
          const schedule = classGroup?.schedule;
          const guardian = student?.guardian;

          if (student && course && classGroup && schedule) {
            rows.push({
              studentId: student.id,
              studentName: student.name,
              shortName: getShortName(student.name),
              birthDate: student.birth_date,
              guardianName: guardian?.name || '-',
              guardianPhone: guardian?.phone || '-',
              courseName: course.name,
              courseId: course.id,
              className: classGroup.name,
              dayOfWeek: schedule.day_of_week,
              startTime: schedule.start_time,
              endTime: schedule.end_time,
              enrollmentStatus: enrollment.status,
              shift: getShift(schedule.start_time),
            });
          }
        });
      }

      return rows;
    }
  });

  // Apply filters
  const filteredData = allocationData.filter(row => {
    const matchesSearch = row.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.guardianName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === 'all' || row.courseName === courseFilter;
    const matchesShift = shiftFilter === 'all' || row.shift === shiftFilter;
    
    // Filter by teacher (teachers are linked to courses)
    let matchesTeacher = teacherFilter === 'all';
    if (!matchesTeacher) {
      const teacher = teachers.find(t => t.id === teacherFilter);
      matchesTeacher = teacher ? row.courseId === teacher.courseId : false;
    }
    
    return matchesSearch && matchesCourse && matchesShift && matchesTeacher;
  });

  // Group by course, then shift, then day
  const groupedData = filteredData.reduce((acc, row) => {
    if (!acc[row.courseName]) {
      acc[row.courseName] = { morning: {}, afternoon: {}, courseId: row.courseId };
    }
    if (!acc[row.courseName][row.shift][row.dayOfWeek]) {
      acc[row.courseName][row.shift][row.dayOfWeek] = [];
    }
    acc[row.courseName][row.shift][row.dayOfWeek].push(row);
    return acc;
  }, {} as Record<string, { morning: Record<string, StudentAllocationRow[]>; afternoon: Record<string, StudentAllocationRow[]>; courseId: string }>);

  // Get unique courses for filter
  const uniqueCourses = [...new Set(allocationData.map(r => r.courseName))];

  // Get teachers for a specific course
  const getTeachersForCourse = (courseId: string) => {
    return teachers.filter(t => t.courseId === courseId);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Erro', description: 'Não foi possível abrir a janela de impressão', variant: 'destructive' });
      return;
    }

    const courseFilterText = courseFilter === 'all' ? 'Todos os cursos' : courseFilter;
    const shiftFilterText = shiftFilter === 'all' ? 'Todos os turnos' : shiftFilter === 'morning' ? 'Matutino' : 'Vespertino';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Agenda Semanal de Alunos</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; font-size: 11px; }
            h1 { font-size: 18px; margin-bottom: 5px; text-align: center; }
            h2 { font-size: 14px; color: #666; margin-bottom: 15px; text-align: center; }
            .course-section { margin-bottom: 25px; page-break-inside: avoid; }
            .course-header { background: #1a1a2e; color: white; padding: 10px 15px; font-weight: bold; font-size: 14px; border-radius: 6px 6px 0 0; }
            .course-teachers { background: #f0f0f0; padding: 8px 15px; font-size: 11px; color: #666; border-bottom: 1px solid #ddd; }
            .shift-section { margin-bottom: 15px; }
            .shift-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 15px; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 8px; }
            .shift-header.morning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
            .shift-header.afternoon { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
            .week-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; border: 1px solid #e5e5e5; }
            .day-column { border-right: 1px solid #e5e5e5; }
            .day-column:last-child { border-right: none; }
            .day-header { padding: 8px; font-weight: bold; text-align: center; color: white; font-size: 10px; }
            .day-header.segunda-feira { background: #3b82f6; }
            .day-header.terca-feira { background: #22c55e; }
            .day-header.quarta-feira { background: #a855f7; }
            .day-header.quinta-feira { background: #f97316; }
            .day-header.sexta-feira { background: #ec4899; }
            .day-content { padding: 6px; min-height: 80px; background: #fafafa; }
            .student-item { background: white; padding: 4px 6px; border-radius: 3px; margin-bottom: 3px; font-size: 9px; border: 1px solid #e5e5e5; }
            .student-name { font-weight: 600; color: #333; }
            .student-time { color: #888; font-size: 8px; }
            .empty-day { color: #999; font-size: 9px; text-align: center; padding: 15px 5px; }
            .summary { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 15px; display: flex; gap: 20px; justify-content: center; }
            .summary p { margin: 0; font-size: 11px; }
            @media print {
              body { padding: 10px; }
              .course-section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Agenda Semanal de Alunos</h1>
          <h2>Filtro: ${courseFilterText} | Turno: ${shiftFilterText} | ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</h2>
          <div class="summary">
            <p><strong>Total de alunos:</strong> ${[...new Set(filteredData.map(r => r.studentId))].length}</p>
            <p><strong>Total de alocações:</strong> ${filteredData.length}</p>
          </div>
          ${Object.entries(groupedData).map(([courseName, data]) => {
            const courseTeachers = getTeachersForCourse(data.courseId);
            const hasMorning = Object.values(data.morning).flat().length > 0;
            const hasAfternoon = Object.values(data.afternoon).flat().length > 0;
            
            return `
              <div class="course-section">
                <div class="course-header">${courseName}</div>
                ${courseTeachers.length > 0 ? `<div class="course-teachers">Professores: ${courseTeachers.map(t => t.name).join(', ')}</div>` : ''}
                
                ${hasMorning && (shiftFilter === 'all' || shiftFilter === 'morning') ? `
                  <div class="shift-section">
                    <div class="shift-header morning">☀️ Turno Matutino (até 12h)</div>
                    <div class="week-grid">
                      ${DAYS_OF_WEEK.map(day => {
                        const students = data.morning[day] || [];
                        const dayClass = day.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('-', '');
                        return `
                          <div class="day-column">
                            <div class="day-header ${dayClass}">${DAY_SHORT_NAMES[day]} (${students.length})</div>
                            <div class="day-content">
                              ${students.length > 0 
                                ? students.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.shortName.localeCompare(b.shortName)).map(s => `
                                    <div class="student-item">
                                      <div class="student-name">${s.shortName}</div>
                                      <div class="student-time">${s.startTime} - ${s.endTime}</div>
                                    </div>
                                  `).join('')
                                : `<div class="empty-day">-</div>`
                              }
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
                
                ${hasAfternoon && (shiftFilter === 'all' || shiftFilter === 'afternoon') ? `
                  <div class="shift-section">
                    <div class="shift-header afternoon">🌅 Turno Vespertino (após 12h)</div>
                    <div class="week-grid">
                      ${DAYS_OF_WEEK.map(day => {
                        const students = data.afternoon[day] || [];
                        const dayClass = day.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('-', '');
                        return `
                          <div class="day-column">
                            <div class="day-header ${dayClass}">${DAY_SHORT_NAMES[day]} (${students.length})</div>
                            <div class="day-content">
                              ${students.length > 0 
                                ? students.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.shortName.localeCompare(b.shortName)).map(s => `
                                    <div class="student-item">
                                      <div class="student-name">${s.shortName}</div>
                                      <div class="student-time">${s.startTime} - ${s.endTime}</div>
                                    </div>
                                  `).join('')
                                : `<div class="empty-day">-</div>`
                              }
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportCSV = () => {
    setIsGenerating(true);
    
    let csvContent = 'Curso,Professor,Turno,Dia,Aluno,Horário,Turma,Responsável,Telefone\n';
    Object.entries(groupedData).forEach(([courseName, data]) => {
      const courseTeachers = getTeachersForCourse(data.courseId);
      const teacherNames = courseTeachers.map(t => t.name).join('; ') || 'Sem professor';
      
      ['morning', 'afternoon'].forEach(shift => {
        const shiftName = shift === 'morning' ? 'Matutino' : 'Vespertino';
        const shiftData = data[shift as 'morning' | 'afternoon'];
        
        DAYS_OF_WEEK.forEach(day => {
          const students = shiftData[day] || [];
          students.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.shortName.localeCompare(b.shortName)).forEach(row => {
            csvContent += `"${courseName}","${teacherNames}","${shiftName}","${day}","${row.shortName}","${row.startTime} - ${row.endTime}","${row.className}","${row.guardianName}","${row.guardianPhone}"\n`;
          });
        });
      });
    });
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agenda_semanal_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    setTimeout(() => setIsGenerating(false), 500);
  };

  const renderShiftSection = (
    shiftData: Record<string, StudentAllocationRow[]>, 
    shiftType: 'morning' | 'afternoon',
    courseName: string
  ) => {
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
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Agenda Semanal de Alunos
          </h1>
          <p className="page-subtitle">Organizado por curso, professor e turno</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger>
                <BookOpen className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cursos</SelectItem>
                {uniqueCourses.map(course => (
                  <SelectItem key={course} value={course}>{course}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={teacherFilter} onValueChange={setTeacherFilter}>
              <SelectTrigger>
                <GraduationCap className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Professor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os professores</SelectItem>
                {teachers.map(teacher => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.courseName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={shiftFilter} onValueChange={(v) => setShiftFilter(v as any)}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                <SelectItem value="morning">
                  <span className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    Matutino
                  </span>
                </SelectItem>
                <SelectItem value="afternoon">
                  <span className="flex items-center gap-2">
                    <Sunset className="w-4 h-4 text-indigo-500" />
                    Vespertino
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{[...new Set(filteredData.map(r => r.studentId))].length}</p>
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
                <p className="text-xl font-bold">{filteredData.filter(r => r.shift === 'morning').length}</p>
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
                <p className="text-xl font-bold">{filteredData.filter(r => r.shift === 'afternoon').length}</p>
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
                <p className="text-xl font-bold">{Object.keys(groupedData).length}</p>
                <p className="text-xs text-muted-foreground">Cursos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course Sections */}
      <div className="space-y-6">
        {Object.entries(groupedData).length > 0 ? (
          Object.entries(groupedData).map(([courseName, data]) => {
            const courseTeachers = getTeachersForCourse(data.courseId);
            const showMorning = shiftFilter === 'all' || shiftFilter === 'morning';
            const showAfternoon = shiftFilter === 'all' || shiftFilter === 'afternoon';
            
            return (
              <Card key={courseName} className="overflow-hidden">
                {/* Course Header */}
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
                      {[...new Set([...Object.values(data.morning).flat(), ...Object.values(data.afternoon).flat()].map(s => s.studentId))].length} alunos
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4">
                  {showMorning && renderShiftSection(data.morning, 'morning', courseName)}
                  {showAfternoon && renderShiftSection(data.afternoon, 'afternoon', courseName)}
                </CardContent>
              </Card>
            );
          })
        ) : isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
              <h3 className="font-medium text-lg mb-2">Carregando agenda...</h3>
              <p className="text-muted-foreground">Buscando dados de alunos</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhum aluno encontrado
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || courseFilter !== 'all' || shiftFilter !== 'all' || teacherFilter !== 'all'
                  ? 'Tente ajustar os filtros' 
                  : 'Não há alunos ativos matriculados'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
