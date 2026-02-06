import { useState, useMemo } from 'react';
import { Calendar, Printer, Download, Loader2, Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useAllocationData } from '@/components/allocation/useAllocationData';
import { usePrintAllocation } from '@/components/allocation/usePrintAllocation';
import { useExportAllocation } from '@/components/allocation/useExportAllocation';
import { AllocationFilters } from '@/components/allocation/AllocationFilters';
import { AllocationStats } from '@/components/allocation/AllocationStats';
import { CourseSection } from '@/components/allocation/CourseSection';
import { AssignTeacherModal } from '@/components/allocation/AssignTeacherModal';
import { ShiftFilter, GroupedCourseData } from '@/components/allocation/types';
import { useSystemBranding } from '@/hooks/useSystemBranding';

// Course order priority: Reforço first, then Robótica, then Soroban, then others
const getCourseOrder = (courseName: string): number => {
  const lowerName = courseName.toLowerCase();
  if (lowerName.includes('reforço')) return 1;
  if (lowerName.includes('robótica') || lowerName.includes('robotica')) return 2;
  if (lowerName.includes('soroban')) return 3;
  return 4;
};

export default function StudentAllocation() {
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const { teachers, allocationData, isLoading } = useAllocationData();
  const { branding } = useSystemBranding();

  // Apply filters
  const filteredData = allocationData.filter(row => {
    const matchesSearch = row.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          row.guardianName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === 'all' || row.courseName === courseFilter;
    const matchesShift = shiftFilter === 'all' || row.shift === shiftFilter;
    
    let matchesTeacher = teacherFilter === 'all';
    if (!matchesTeacher) {
      const teacher = teachers.find(t => t.id === teacherFilter);
      matchesTeacher = teacher ? row.courseId === teacher.courseId : false;
    }
    
    return matchesSearch && matchesCourse && matchesShift && matchesTeacher;
  });

  // Group by course (or by teacher for "Reforço Escolar"), then shift, then day
  const groupedData = filteredData.reduce((acc, row) => {
    const isReforco = row.courseName.toLowerCase().includes('reforço');
    
    // For Reforço Escolar, group by teacher; for others, group by course
    let groupKey: string;
    let teacherId: string | undefined;
    let teacherName: string | undefined;
    
    if (isReforco && row.teacherId) {
      groupKey = `${row.courseName} - ${row.teacherName || 'Sem professor'}`;
      teacherId = row.teacherId;
      teacherName = row.teacherName;
    } else if (isReforco && !row.teacherId) {
      groupKey = `${row.courseName} - Sem professor atribuído`;
    } else {
      groupKey = row.courseName;
    }
    
    if (!acc[groupKey]) {
      acc[groupKey] = { 
        morning: {}, 
        afternoon: {}, 
        courseId: row.courseId,
        teacherId,
        teacherName
      };
    }
    if (!acc[groupKey][row.shift][row.dayOfWeek]) {
      acc[groupKey][row.shift][row.dayOfWeek] = [];
    }
    acc[groupKey][row.shift][row.dayOfWeek].push(row);
    return acc;
  }, {} as Record<string, GroupedCourseData>);

  // Get unique courses for filter
  const uniqueCourses = [...new Set(allocationData.map(r => r.courseName))];

  // Sort courses by priority order and filter out unassigned Reforço sections
  const sortedGroupedData = useMemo(() => {
    return Object.entries(groupedData)
      .filter(([key]) => !key.includes('Sem professor atribuído'))
      .sort(([a], [b]) => {
        const orderA = getCourseOrder(a);
        const orderB = getCourseOrder(b);
        if (orderA !== orderB) return orderA - orderB;
        // For same priority, sort alphabetically (handles multiple Reforço teachers)
        return a.localeCompare(b);
      });
  }, [groupedData]);

  const { handlePrint } = usePrintAllocation({
    filteredData,
    groupedData,
    teachers,
    courseFilter,
    shiftFilter
  });

  const { handleExportCSV, isGenerating } = useExportAllocation({
    groupedData,
    teachers
  });

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
          <Button variant="outline" onClick={() => setAssignModalOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Atribuir Professoras
          </Button>
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

      <AllocationFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        courseFilter={courseFilter}
        setCourseFilter={setCourseFilter}
        teacherFilter={teacherFilter}
        setTeacherFilter={setTeacherFilter}
        shiftFilter={shiftFilter}
        setShiftFilter={setShiftFilter}
        uniqueCourses={uniqueCourses}
        teachers={teachers}
      />

      <AllocationStats filteredData={filteredData} groupedData={groupedData} />

      <div className="space-y-4">
        {sortedGroupedData.length > 0 ? (
          sortedGroupedData.map(([courseName, data]) => (
            <CourseSection
              key={courseName}
              courseName={courseName}
              data={data}
              teachers={teachers}
              shiftFilter={shiftFilter}
              systemLogo={branding.logo || undefined}
              schoolName={branding.name || undefined}
            />
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
                {searchTerm || courseFilter !== 'all' || shiftFilter !== 'all' || teacherFilter !== 'all'
                  ? 'Tente ajustar os filtros' 
                  : 'Não há alunos ativos matriculados'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <AssignTeacherModal 
        open={assignModalOpen} 
        onOpenChange={setAssignModalOpen} 
      />
    </div>
  );
}
