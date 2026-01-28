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
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  className: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enrollmentStatus: string;
}

const DAYS_OF_WEEK = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const DAY_COLORS: Record<string, string> = {
  'Segunda-feira': 'bg-blue-500',
  'Terça-feira': 'bg-green-500',
  'Quarta-feira': 'bg-purple-500',
  'Quinta-feira': 'bg-orange-500',
  'Sexta-feira': 'bg-pink-500',
  'Sábado': 'bg-amber-500',
};

// Short names for display
const DAY_SHORT_NAMES: Record<string, string> = {
  'Segunda-feira': 'Segunda',
  'Terça-feira': 'Terça',
  'Quarta-feira': 'Quarta',
  'Quinta-feira': 'Quinta',
  'Sexta-feira': 'Sexta',
  'Sábado': 'Sábado',
};

// Função para expandir dias combinados (ex: "Segunda e Quarta" -> ["Segunda-feira", "Quarta-feira"])
const expandCombinedDays = (dayOfWeek: string): string[] => {
  const dayMap: Record<string, string> = {
    'segunda': 'Segunda-feira',
    'terça': 'Terça-feira',
    'quarta': 'Quarta-feira',
    'quinta': 'Quinta-feira',
    'sexta': 'Sexta-feira',
    'sábado': 'Sábado',
    'sabado': 'Sábado',
  };

  // Se já é um dia da semana padrão, retorna ele mesmo
  if (DAYS_OF_WEEK.includes(dayOfWeek)) {
    return [dayOfWeek];
  }

  // Tenta encontrar dias no formato "Dia e Dia" ou "Dia, Dia"
  const normalizedDay = dayOfWeek.toLowerCase();
  const foundDays: string[] = [];

  Object.entries(dayMap).forEach(([key, value]) => {
    if (normalizedDay.includes(key)) {
      foundDays.push(value);
    }
  });

  return foundDays.length > 0 ? foundDays : [dayOfWeek];
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
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch all allocation data directly from database
  const { data: allocationData = [], isLoading } = useQuery({
    queryKey: ['student-allocation'],
    queryFn: async () => {
      // Fetch active enrollments with all related data
      const { data: enrollmentsData, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          student:students!inner(
            id,
            name,
            birth_date,
            is_active,
            guardian:guardians(name, phone)
          ),
          class_group:class_groups!inner(
            id,
            name,
            is_active,
            course:courses(id, name),
            schedule:schedules(day_of_week, start_time, end_time)
          )
        `)
        .eq('status', 'active')
        .eq('students.is_active', true)
        .eq('class_groups.is_active', true);

      if (error) throw error;

      const rows: StudentAllocationRow[] = [];

      enrollmentsData?.forEach((enrollment: any) => {
        const student = enrollment.student;
        const classGroup = enrollment.class_group;
        const course = classGroup?.course;
        const schedule = classGroup?.schedule;
        const guardian = student?.guardian;

        if (student && course && classGroup && schedule) {
          // Expande dias combinados para criar múltiplas entradas
          const expandedDays = expandCombinedDays(schedule.day_of_week);
          
          expandedDays.forEach(day => {
            rows.push({
              studentId: student.id,
              studentName: student.name,
              shortName: getShortName(student.name),
              birthDate: student.birth_date,
              guardianName: guardian?.name || '-',
              guardianPhone: guardian?.phone || '-',
              courseName: course.name,
              className: classGroup.name,
              dayOfWeek: day,
              startTime: schedule.start_time,
              endTime: schedule.end_time,
              enrollmentStatus: enrollment.status,
            });
          });
        }
      });

      return rows;
    }
  });

  // Apply filters
  const filteredData = allocationData.filter(row => {
    const matchesSearch = row.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.guardianName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === 'all' || row.courseName === courseFilter;
    return matchesSearch && matchesCourse;
  });

  // Group by course, then by day
  const groupedByCourseAndDay = filteredData.reduce((acc, row) => {
    if (!acc[row.courseName]) {
      acc[row.courseName] = {};
    }
    if (!acc[row.courseName][row.dayOfWeek]) {
      acc[row.courseName][row.dayOfWeek] = [];
    }
    acc[row.courseName][row.dayOfWeek].push(row);
    return acc;
  }, {} as Record<string, Record<string, StudentAllocationRow[]>>);

  // Get unique courses for filter
  const uniqueCourses = [...new Set(allocationData.map(r => r.courseName))];

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Erro', description: 'Não foi possível abrir a janela de impressão', variant: 'destructive' });
      return;
    }

    const courseFilterText = courseFilter === 'all' ? 'Todos os cursos' : courseFilter;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Agenda Semanal de Alunos</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
            h1 { font-size: 22px; margin-bottom: 5px; text-align: center; }
            h2 { font-size: 16px; color: #666; margin-bottom: 20px; text-align: center; }
            .course-section { margin-bottom: 30px; page-break-inside: avoid; }
            .course-title { background: #333; color: white; padding: 10px 15px; font-weight: bold; font-size: 16px; margin-bottom: 15px; border-radius: 6px; }
            .week-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
            .day-column { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
            .day-header { padding: 10px; font-weight: bold; text-align: center; color: white; font-size: 12px; }
            .day-header.segunda-feira { background: #3b82f6; }
            .day-header.terca-feira { background: #22c55e; }
            .day-header.quarta-feira { background: #a855f7; }
            .day-header.quinta-feira { background: #f97316; }
            .day-header.sexta-feira { background: #ec4899; }
            .day-header.sabado { background: #f59e0b; }
            .day-content { padding: 8px; min-height: 100px; background: #fafafa; }
            .student-item { background: white; padding: 6px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 11px; border: 1px solid #e5e5e5; }
            .student-name { font-weight: 600; color: #333; }
            .student-time { color: #666; font-size: 10px; margin-top: 2px; }
            .empty-day { color: #999; font-size: 11px; text-align: center; padding: 20px 8px; }
            .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary p { margin: 5px 0; font-size: 13px; }
            @media print {
              body { padding: 10px; }
              .course-section { page-break-inside: avoid; }
              .week-grid { grid-template-columns: repeat(6, 1fr); }
            }
          </style>
        </head>
        <body>
          <h1>Agenda Semanal de Alunos</h1>
          <h2>Filtro: ${courseFilterText} | Data: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</h2>
          <div class="summary">
            <p><strong>Total de alunos:</strong> ${[...new Set(filteredData.map(r => r.studentId))].length}</p>
            <p><strong>Total de matrículas:</strong> ${filteredData.length}</p>
          </div>
          ${Object.entries(groupedByCourseAndDay).map(([courseName, dayData]) => `
            <div class="course-section">
              <div class="course-title">${courseName}</div>
              <div class="week-grid">
                ${DAYS_OF_WEEK.map(day => {
                  const students = dayData[day] || [];
                  const dayClass = day.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' ', '-');
                  return `
                    <div class="day-column">
                      <div class="day-header ${dayClass}">${DAY_SHORT_NAMES[day] || day}</div>
                      <div class="day-content">
                        ${students.length > 0 
                          ? students.sort((a, b) => a.shortName.localeCompare(b.shortName)).map(s => `
                              <div class="student-item">
                                <div class="student-name">${s.shortName}</div>
                                <div class="student-time">${s.startTime} - ${s.endTime}</div>
                              </div>
                            `).join('')
                          : `<div class="empty-day">Sem alunos</div>`
                        }
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
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
    
    let csvContent = 'Curso,Dia,Aluno,Horário,Turma,Responsável,Telefone\n';
    Object.entries(groupedByCourseAndDay).forEach(([courseName, dayData]) => {
      DAYS_OF_WEEK.forEach(day => {
        const students = dayData[day] || [];
        students.sort((a, b) => a.shortName.localeCompare(b.shortName)).forEach(row => {
          csvContent += `"${courseName}","${day}","${row.shortName}","${row.startTime} - ${row.endTime}","${row.className}","${row.guardianName}","${row.guardianPhone}"\n`;
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

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Agenda Semanal de Alunos
          </h1>
          <p className="page-subtitle">Visualize os alunos organizados por dia da semana e curso</p>
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
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por aluno ou responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cursos</SelectItem>
                  {uniqueCourses.map(course => (
                    <SelectItem key={course} value={course}>{course}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{[...new Set(filteredData.map(r => r.studentId))].length}</p>
                <p className="text-sm text-muted-foreground">Alunos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredData.length}</p>
                <p className="text-sm text-muted-foreground">Matrículas Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Object.keys(groupedByCourseAndDay).length}</p>
                <p className="text-sm text-muted-foreground">Cursos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Calendar by Course */}
      <div className="space-y-6">
        {Object.entries(groupedByCourseAndDay).length > 0 ? (
          Object.entries(groupedByCourseAndDay).map(([courseName, dayData]) => (
            <Card key={courseName} className="overflow-hidden">
              <div className="bg-secondary/50 px-4 py-3 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-lg">{courseName}</span>
                </div>
                <Badge variant="secondary">
                  {Object.values(dayData).flat().length} alunos
                </Badge>
              </div>
              
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {DAYS_OF_WEEK.map(day => {
                    const studentsForDay = dayData[day] || [];
                    const colorClass = DAY_COLORS[day] || 'bg-gray-500';
                    
                    return (
                      <div key={day} className="border rounded-lg overflow-hidden bg-card">
                        <div className={`${colorClass} text-white text-center py-2 font-medium text-sm`}>
                          {DAY_SHORT_NAMES[day] || day}
                          {studentsForDay.length > 0 && (
                            <span className="ml-1 opacity-75">({studentsForDay.length})</span>
                          )}
                        </div>
                        <div className="p-2 min-h-[120px] max-h-[300px] overflow-y-auto space-y-1">
                          {studentsForDay.length > 0 ? (
                            studentsForDay
                              .sort((a, b) => a.shortName.localeCompare(b.shortName))
                              .map((student, idx) => (
                                <div 
                                  key={`${student.studentId}-${idx}`}
                                  className="bg-muted/50 rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                                >
                                  <div className="font-medium text-foreground truncate" title={student.studentName}>
                                    {student.shortName}
                                  </div>
                                  <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    {student.startTime} - {student.endTime}
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center text-muted-foreground text-xs py-8">
                              Sem alunos
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
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
                {searchTerm || courseFilter !== 'all' 
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
