import { useState, useRef } from 'react';
import { BookOpen, GraduationCap, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShiftSection } from './ShiftSection';
import { GroupedCourseData, Teacher, ShiftFilter, DAYS_OF_WEEK, DAY_SHORT_NAMES } from './types';

interface CourseSectionProps {
  courseName: string;
  data: GroupedCourseData;
  teachers: Teacher[];
  shiftFilter: ShiftFilter;
  systemLogo?: string;
  schoolName?: string;
}

export function CourseSection({ courseName, data, teachers, shiftFilter, systemLogo, schoolName }: CourseSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  
  // For Reforço Escolar grouped by teacher, use the teacher from data
  // For other courses, find teachers by courseId
  // Don't show all teachers for "unassigned" Reforço groups
  const isReforcoByTeacher = data.teacherId && data.teacherName;
  const isUnassignedReforco = courseName.toLowerCase().includes('reforço') && !data.teacherId;
  const courseTeachers = isReforcoByTeacher 
    ? [{ id: data.teacherId!, name: data.teacherName!, courseId: data.courseId, courseName }]
    : isUnassignedReforco 
      ? [] // Don't list all teachers for unassigned group
      : teachers.filter(t => t.courseId === data.courseId);
  
  const showMorning = shiftFilter === 'all' || shiftFilter === 'morning';
  const showAfternoon = shiftFilter === 'all' || shiftFilter === 'afternoon';
  
  const uniqueStudentIds = [
    ...new Set([
      ...Object.values(data.morning).flat(),
      ...Object.values(data.afternoon).flat()
    ].map(s => s.studentId))
  ];

  // Extract display name (remove teacher suffix if present for cleaner display)
  const displayName = courseName.includes(' - ') 
    ? courseName.split(' - ')[0] 
    : courseName;
  
  const teacherDisplayName = isReforcoByTeacher 
    ? data.teacherName 
    : courseTeachers.length > 0 
      ? courseTeachers.map(t => t.name).join(', ')
      : null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Generate table HTML for each shift
    const generateShiftTable = (shiftData: Record<string, any[]>, shiftLabel: string, shiftColor: string) => {
      const hasStudents = Object.values(shiftData).flat().length > 0;
      if (!hasStudents) return '';

      const uniqueCount = [...new Set(Object.values(shiftData).flat().map((s: any) => s.studentId))].length;

      return `
        <div class="shift-section">
          <div class="shift-header" style="background: ${shiftColor};">
            <span>${shiftLabel}</span>
            <span class="student-count">${uniqueCount} alunos</span>
          </div>
          <table>
            <thead>
              <tr>
                ${DAYS_OF_WEEK.map(day => `<th>${DAY_SHORT_NAMES[day]}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${DAYS_OF_WEEK.map(day => {
                  const students = shiftData[day] || [];
                  const sorted = students.sort((a: any, b: any) => 
                    a.startTime.localeCompare(b.startTime) || a.shortName.localeCompare(b.shortName)
                  );
                  return `
                    <td>
                      ${sorted.map((s: any) => `
                        <div class="student-item">
                          <span class="student-name">${s.shortName}</span>
                          <span class="student-time">${s.startTime} - ${s.endTime}</span>
                        </div>
                      `).join('')}
                      ${students.length === 0 ? '<span class="empty">-</span>' : ''}
                    </td>
                  `;
                }).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      `;
    };

    const morningHtml = showMorning ? generateShiftTable(data.morning, 'Turno Matutino', 'linear-gradient(135deg, #f59e0b, #ea580c)') : '';
    const afternoonHtml = showAfternoon ? generateShiftTable(data.afternoon, 'Turno Vespertino', 'linear-gradient(135deg, #6366f1, #8b5cf6)') : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Agenda - ${displayName}${teacherDisplayName ? ` - ${teacherDisplayName}` : ''}</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            background: white;
            padding: 20px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 16px;
            border-bottom: 3px solid #ea580c;
            margin-bottom: 24px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
          }
          .header-info h1 {
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
          }
          .header-info p {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
          }
          .header-right {
            text-align: right;
          }
          .header-right .date {
            font-size: 11px;
            color: #64748b;
          }
          .header-right .student-total {
            font-size: 14px;
            font-weight: 600;
            color: #ea580c;
            margin-top: 4px;
          }
          .course-title {
            background: linear-gradient(135deg, #1e293b, #334155);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .course-title h2 {
            font-size: 16px;
            font-weight: 600;
          }
          .course-title .teacher {
            font-size: 13px;
            opacity: 0.8;
          }
          .shift-section {
            margin-bottom: 24px;
          }
          .shift-header {
            color: white;
            padding: 8px 16px;
            border-radius: 6px 6px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 13px;
          }
          .student-count {
            background: rgba(255,255,255,0.2);
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 11px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border: 1px solid #e2e8f0;
            border-top: none;
          }
          th {
            background: #f8fafc;
            padding: 10px;
            text-align: center;
            font-weight: 600;
            font-size: 12px;
            color: #475569;
            border: 1px solid #e2e8f0;
          }
          td {
            padding: 8px;
            vertical-align: top;
            border: 1px solid #e2e8f0;
            min-width: 140px;
          }
          .student-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 8px;
            margin-bottom: 4px;
          }
          .student-name {
            display: block;
            font-size: 11px;
            font-weight: 500;
            color: #1e293b;
          }
          .student-time {
            display: block;
            font-size: 9px;
            color: #64748b;
            margin-top: 2px;
          }
          .empty {
            color: #94a3b8;
            font-size: 12px;
            display: block;
            text-align: center;
            padding: 20px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${systemLogo ? `<img src="${systemLogo}" alt="Logo" class="logo" />` : ''}
            <div class="header-info">
              <h1>${schoolName || 'Circuito Kids'}</h1>
              <p>Agenda Semanal de Alunos</p>
            </div>
          </div>
          <div class="header-right">
            <div class="date">${currentDate}</div>
            <div class="student-total">${uniqueStudentIds.length} alunos</div>
          </div>
        </div>

        <div class="course-title">
          <div>
            <h2>${displayName}</h2>
            ${teacherDisplayName ? `<span class="teacher">Prof. ${teacherDisplayName}</span>` : ''}
          </div>
        </div>

        ${morningHtml}
        ${afternoonHtml}

        <div class="footer">
          <span>${schoolName || 'Circuito Kids'} - Sistema de Gestão Escolar</span>
          <span>Gerado em ${currentDate}</span>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <Card className="overflow-hidden print-section" ref={printRef}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer flex-1 text-left">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {displayName}
                    {isOpen ? <ChevronUp className="w-4 h-4 opacity-60" /> : <ChevronDown className="w-4 h-4 opacity-60" />}
                  </CardTitle>
                  {teacherDisplayName && (
                    <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {teacherDisplayName}
                    </p>
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handlePrint}
                className="text-white hover:bg-white/10 h-8 px-2"
                title="Imprimir esta seção"
              >
                <Printer className="w-4 h-4" />
              </Button>
              <Badge className="bg-white/20 text-white hover:bg-white/30">
                {uniqueStudentIds.length} alunos
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="p-4">
            {showMorning && <ShiftSection shiftData={data.morning} shiftType="morning" />}
            {showAfternoon && <ShiftSection shiftData={data.afternoon} shiftType="afternoon" />}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
