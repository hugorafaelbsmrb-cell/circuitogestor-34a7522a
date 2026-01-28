import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { 
  StudentAllocationRow, 
  GroupedCourseData, 
  Teacher, 
  ShiftFilter,
  DAYS_OF_WEEK, 
  DAY_SHORT_NAMES 
} from './types';

interface UsePrintAllocationProps {
  filteredData: StudentAllocationRow[];
  groupedData: Record<string, GroupedCourseData>;
  teachers: Teacher[];
  courseFilter: string;
  shiftFilter: ShiftFilter;
}

export function usePrintAllocation({
  filteredData,
  groupedData,
  teachers,
  courseFilter,
  shiftFilter
}: UsePrintAllocationProps) {
  const { toast } = useToast();

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

  return { handlePrint };
}
