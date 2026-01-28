import { useState } from 'react';
import { format } from 'date-fns';
import { 
  GroupedCourseData, 
  Teacher, 
  DAYS_OF_WEEK 
} from './types';

interface UseExportAllocationProps {
  groupedData: Record<string, GroupedCourseData>;
  teachers: Teacher[];
}

export function useExportAllocation({ groupedData, teachers }: UseExportAllocationProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const getTeachersForCourse = (courseId: string) => {
    return teachers.filter(t => t.courseId === courseId);
  };

  const handleExportCSV = () => {
    setIsGenerating(true);
    
    let csvContent = 'Curso,Professor,Turno,Dia,Aluno,Horário,Turma,Responsável,Telefone\n';
    Object.entries(groupedData).forEach(([courseName, data]) => {
      const courseTeachers = getTeachersForCourse(data.courseId);
      const teacherNames = courseTeachers.map(t => t.name).join('; ') || 'Sem professor';
      
      (['morning', 'afternoon'] as const).forEach(shift => {
        const shiftName = shift === 'morning' ? 'Matutino' : 'Vespertino';
        const shiftData = data[shift];
        
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

  return { handleExportCSV, isGenerating };
}
