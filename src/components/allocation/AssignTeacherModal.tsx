import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Users, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AssignTeacherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StudentForAssignment {
  id: string;
  name: string;
  teacherId: string | null;
  teacherName: string | null;
}

interface TeacherOption {
  id: string;
  name: string;
  studentCount: number;
}

export function AssignTeacherModal({ open, onOpenChange }: AssignTeacherModalProps) {
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

  // Fetch Reforço Escolar students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['reforco-students-for-assignment'],
    queryFn: async () => {
      // First get the Reforço Escolar course
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .ilike('name', '%reforço%')
        .single();

      if (!course) return [];

      // Get all active enrollments in Reforço Escolar
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          id,
          student:students(
            id,
            name,
            teacher_id,
            teacher:teachers(name)
          ),
          class_group:class_groups(
            course_id
          )
        `)
        .eq('status', 'active');

      const reforcoStudents: StudentForAssignment[] = [];
      const seenStudentIds = new Set<string>();

      enrollments?.forEach((enrollment: any) => {
        const student = enrollment.student;
        const classGroup = enrollment.class_group;
        
        if (student && classGroup?.course_id === course.id && !seenStudentIds.has(student.id)) {
          seenStudentIds.add(student.id);
          reforcoStudents.push({
            id: student.id,
            name: student.name,
            teacherId: student.teacher_id,
            teacherName: student.teacher?.name || null,
          });
        }
      });

      return reforcoStudents.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open,
  });

  // Fetch Reforço Escolar teachers
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['reforco-teachers'],
    queryFn: async () => {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .ilike('name', '%reforço%')
        .single();

      if (!course) return [];

      const { data } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('course_id', course.id)
        .eq('is_active', true)
        .order('name');

      // Count students per teacher
      const teachersWithCounts: TeacherOption[] = await Promise.all(
        (data || []).map(async (teacher) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', teacher.id)
            .eq('is_active', true);

          return {
            id: teacher.id,
            name: teacher.name,
            studentCount: count || 0,
          };
        })
      );

      return teachersWithCounts;
    },
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ studentIds, teacherId }: { studentIds: string[]; teacherId: string }) => {
      const { error } = await supabase
        .from('students')
        .update({ teacher_id: teacherId })
        .in('id', studentIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Alunos atribuídos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['reforco-students-for-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['reforco-teachers'] });
      queryClient.invalidateQueries({ queryKey: ['student-allocation'] });
      setSelectedStudents([]);
      setSelectedTeacher(null);
    },
    onError: () => {
      toast.error('Erro ao atribuir alunos');
    },
  });

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllWithoutTeacher = () => {
    const withoutTeacher = students.filter(s => !s.teacherId).map(s => s.id);
    setSelectedStudents(withoutTeacher);
  };

  const handleAssign = () => {
    if (!selectedTeacher || selectedStudents.length === 0) return;
    assignMutation.mutate({ studentIds: selectedStudents, teacherId: selectedTeacher });
  };

  const isLoading = loadingStudents || loadingTeachers;
  const studentsWithoutTeacher = students.filter(s => !s.teacherId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Atribuir Alunos às Professoras - Reforço Escolar
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
            {/* Left: Teachers */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">
                Selecione a Professora
              </h3>
              <div className="space-y-2">
                {teachers.map(teacher => (
                  <button
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      selectedTeacher === teacher.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{teacher.name}</span>
                      </div>
                      <Badge variant="secondary">
                        {teacher.studentCount} alunos
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Students */}
            <div className="space-y-3 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Selecione os Alunos ({selectedStudents.length} selecionados)
                </h3>
                {studentsWithoutTeacher.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSelectAllWithoutTeacher}
                  >
                    Selecionar sem professora ({studentsWithoutTeacher.length})
                  </Button>
                )}
              </div>
              
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-2 space-y-1">
                  {students.map(student => (
                    <label
                      key={student.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                        selectedStudents.includes(student.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{student.name}</span>
                      </div>
                      {student.teacherName ? (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {student.teacherName.split(' ')[0]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0 bg-amber-500/10 text-amber-600">
                          Sem prof.
                        </Badge>
                      )}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedTeacher || selectedStudents.length === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Atribuir {selectedStudents.length} aluno(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
