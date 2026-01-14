import { useState, useRef } from 'react';
import { 
  Users, 
  Search, 
  Printer,
  Download,
  FileDown,
  Loader2,
  Calendar,
  Clock,
  BookOpen,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSchool } from '@/contexts/SchoolContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface StudentAllocationRow {
  studentId: string;
  studentName: string;
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

export default function StudentAllocation() {
  const { toast } = useToast();
  const { 
    students, 
    guardians,
    enrollments,
    courses,
    classGroups,
    schedules,
  } = useSchool();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Build allocation data - only active students
  const allocationData: StudentAllocationRow[] = [];
  
  // Only include active students
  const activeStudents = students.filter(s => (s as any).is_active !== false);
  
  activeStudents.forEach(student => {
    const studentEnrollments = enrollments.filter(e => e.student_id === student.id && e.status === 'active');
    const guardian = guardians.find(g => g.id === student.guardian_id);
    
    studentEnrollments.forEach(enrollment => {
      const classGroup = classGroups.find(cg => cg.id === enrollment.class_group_id);
      const course = classGroup ? courses.find(c => c.id === classGroup.course_id) : null;
      const schedule = classGroup ? schedules.find(s => s.id === classGroup.schedule_id) : null;
      
      if (course && classGroup && schedule) {
        allocationData.push({
          studentId: student.id,
          studentName: student.name,
          birthDate: student.birth_date,
          guardianName: guardian?.name || '-',
          guardianPhone: guardian?.phone || '-',
          courseName: course.name,
          className: classGroup.name,
          dayOfWeek: schedule.day_of_week,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          enrollmentStatus: enrollment.status,
        });
      }
    });
  });

  // Apply filters
  const filteredData = allocationData.filter(row => {
    const matchesSearch = row.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.guardianName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === 'all' || row.courseName === courseFilter;
    return matchesSearch && matchesCourse;
  });

  // Group by course for summary
  const groupedByCourse = filteredData.reduce((acc, row) => {
    if (!acc[row.courseName]) {
      acc[row.courseName] = [];
    }
    acc[row.courseName].push(row);
    return acc;
  }, {} as Record<string, StudentAllocationRow[]>);

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
          <title>Relatório de Alocação de Alunos</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
            h1 { font-size: 22px; margin-bottom: 5px; text-align: center; }
            h2 { font-size: 16px; color: #666; margin-bottom: 20px; text-align: center; }
            .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary p { margin: 5px 0; }
            .course-section { margin-bottom: 30px; page-break-inside: avoid; }
            .course-title { background: #333; color: white; padding: 8px 12px; font-weight: bold; margin-bottom: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 0; font-size: 12px; }
            th, td { text-align: left; padding: 8px; border: 1px solid #ddd; }
            th { background: #f0f0f0; font-weight: 600; }
            .badge { background: #e0f2e9; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
            @media print {
              body { padding: 10px; }
              .course-section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Relatório de Alocação de Alunos</h1>
          <h2>Filtro: ${courseFilterText} | Data: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</h2>
          <div class="summary">
            <p><strong>Total de alunos:</strong> ${[...new Set(filteredData.map(r => r.studentId))].length}</p>
            <p><strong>Total de matrículas:</strong> ${filteredData.length}</p>
            <p><strong>Cursos:</strong> ${Object.keys(groupedByCourse).join(', ')}</p>
          </div>
          ${Object.entries(groupedByCourse).map(([courseName, rows]) => `
            <div class="course-section">
              <div class="course-title">${courseName} (${rows.length} alunos)</div>
              <table>
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Responsável</th>
                    <th>Telefone</th>
                    <th>Turma</th>
                    <th>Dia</th>
                    <th>Horário</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.sort((a, b) => a.studentName.localeCompare(b.studentName)).map(row => `
                    <tr>
                      <td>${row.studentName}</td>
                      <td>${row.guardianName}</td>
                      <td>${row.guardianPhone}</td>
                      <td>${row.className}</td>
                      <td>${row.dayOfWeek}</td>
                      <td>${row.startTime} - ${row.endTime}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
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
    
    let csvContent = 'Aluno,Data Nascimento,Responsável,Telefone,Curso,Turma,Dia,Horário\n';
    filteredData.forEach(row => {
      csvContent += `"${row.studentName}","${format(parseISO(row.birthDate), 'dd/MM/yyyy')}","${row.guardianName}","${row.guardianPhone}","${row.courseName}","${row.className}","${row.dayOfWeek}","${row.startTime} - ${row.endTime}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alocacao_alunos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    setTimeout(() => setIsGenerating(false), 500);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-6 h-6" />
            Alocação de Alunos
          </h1>
          <p className="page-subtitle">Visualize onde cada aluno está alocado com turma e horário</p>
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
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-success" />
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
                <p className="text-2xl font-bold">{Object.keys(groupedByCourse).length}</p>
                <p className="text-sm text-muted-foreground">Cursos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div ref={printRef} className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {Object.entries(groupedByCourse).length > 0 ? (
          Object.entries(groupedByCourse).map(([courseName, rows]) => (
            <div key={courseName} className="border-b border-border last:border-b-0">
              <div className="bg-secondary/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{courseName}</span>
                </div>
                <Badge variant="secondary">{rows.length} alunos</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Horário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.sort((a, b) => a.studentName.localeCompare(b.studentName)).map((row, index) => (
                    <TableRow key={`${row.studentId}-${index}`}>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>{row.guardianName}</TableCell>
                      <TableCell>{row.guardianPhone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.className}</Badge>
                      </TableCell>
                      <TableCell>{row.dayOfWeek}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3" />
                          {row.startTime} - {row.endTime}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        ) : (
          <div className="p-12 text-center">
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
          </div>
        )}
      </div>
    </div>
  );
}