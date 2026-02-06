import { useState, useEffect } from 'react';
import { Loader2, Calendar, Clock, Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Schedule {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface ClassGroup {
  id: string;
  name: string;
  course_id: string;
  schedule_id: string;
  is_active: boolean;
  course?: {
    id: string;
    name: string;
  };
  schedule?: Schedule;
}

interface EnrollmentSchedule {
  id: string;
  enrollment_id: string;
  class_group_id: string;
  class_group?: ClassGroup;
}

interface Enrollment {
  id: string;
  student_id: string;
  class_group_id: string;
  status: string;
  class_group?: ClassGroup;
}

interface EditScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    name: string;
  } | null;
  onSuccess: () => void;
}

export function EditScheduleModal({ open, onOpenChange, student, onSuccess }: EditScheduleModalProps) {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentSchedules, setEnrollmentSchedules] = useState<EnrollmentSchedule[]>([]);
  const [allClassGroups, setAllClassGroups] = useState<ClassGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [selectedNewClassGroupId, setSelectedNewClassGroupId] = useState<string>('');
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [scheduleToRemove, setScheduleToRemove] = useState<EnrollmentSchedule | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceSchedule, setReplaceSchedule] = useState<EnrollmentSchedule | null>(null);
  const [replaceWithClassGroupId, setReplaceWithClassGroupId] = useState<string>('');

  useEffect(() => {
    if (open && student) {
      fetchData();
    }
  }, [open, student?.id]);

  const fetchData = async () => {
    if (!student) return;
    
    setIsLoading(true);
    try {
      // Fetch student's enrollments with class group info
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          class_group_id,
          status,
          class_group:class_groups(
            id,
            name,
            course_id,
            schedule_id,
            is_active,
            course:courses(id, name),
            schedule:schedules(id, day_of_week, start_time, end_time)
          )
        `)
        .eq('student_id', student.id)
        .eq('status', 'active');

      if (enrollmentError) throw enrollmentError;
      setEnrollments(enrollmentData as unknown as Enrollment[]);

      // Fetch enrollment_schedules for this student's enrollments
      const enrollmentIds = (enrollmentData || []).map(e => e.id);
      if (enrollmentIds.length > 0) {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('enrollment_schedules')
          .select(`
            id,
            enrollment_id,
            class_group_id,
            class_group:class_groups(
              id,
              name,
              course_id,
              schedule_id,
              is_active,
              course:courses(id, name),
              schedule:schedules(id, day_of_week, start_time, end_time)
            )
          `)
          .in('enrollment_id', enrollmentIds);

        if (scheduleError) throw scheduleError;
        setEnrollmentSchedules(scheduleData as unknown as EnrollmentSchedule[]);
      } else {
        setEnrollmentSchedules([]);
      }

      // Fetch all active class groups for selection
      const { data: classGroupData, error: classGroupError } = await supabase
        .from('class_groups')
        .select(`
          id,
          name,
          course_id,
          schedule_id,
          is_active,
          course:courses(id, name),
          schedule:schedules(id, day_of_week, start_time, end_time)
        `)
        .eq('is_active', true);

      if (classGroupError) throw classGroupError;
      setAllClassGroups(classGroupData as unknown as ClassGroup[]);

    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os horários do aluno.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSchedulesForEnrollment = (enrollmentId: string) => {
    return enrollmentSchedules.filter(es => es.enrollment_id === enrollmentId);
  };

  const getAvailableClassGroupsForCourse = (courseId: string, excludeIds: string[] = []) => {
    return allClassGroups.filter(cg => 
      cg.course_id === courseId && 
      !excludeIds.includes(cg.id)
    );
  };

  const handleAddSchedule = async () => {
    if (!selectedEnrollmentId || !selectedNewClassGroupId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('enrollment_schedules')
        .insert({
          enrollment_id: selectedEnrollmentId,
          class_group_id: selectedNewClassGroupId,
        });

      if (error) throw error;

      toast({
        title: 'Horário adicionado',
        description: 'O novo dia/horário foi adicionado com sucesso.',
      });

      setShowAddSchedule(false);
      setSelectedEnrollmentId('');
      setSelectedNewClassGroupId('');
      await fetchData();
      onSuccess();
    } catch (error) {
      console.error('Error adding schedule:', error);
      toast({
        title: 'Erro ao adicionar horário',
        description: 'Não foi possível adicionar o horário.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!scheduleToRemove) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('enrollment_schedules')
        .delete()
        .eq('id', scheduleToRemove.id);

      if (error) throw error;

      toast({
        title: 'Horário removido',
        description: 'O dia/horário foi removido com sucesso.',
      });

      setScheduleToRemove(null);
      await fetchData();
      onSuccess();
    } catch (error) {
      console.error('Error removing schedule:', error);
      toast({
        title: 'Erro ao remover horário',
        description: 'Não foi possível remover o horário.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceSchedule = async () => {
    if (!replaceSchedule || !replaceWithClassGroupId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('enrollment_schedules')
        .update({ class_group_id: replaceWithClassGroupId })
        .eq('id', replaceSchedule.id);

      if (error) throw error;

      toast({
        title: 'Horário substituído',
        description: 'O dia/horário foi substituído com sucesso.',
      });

      setShowReplaceModal(false);
      setReplaceSchedule(null);
      setReplaceWithClassGroupId('');
      await fetchData();
      onSuccess();
    } catch (error) {
      console.error('Error replacing schedule:', error);
      toast({
        title: 'Erro ao substituir horário',
        description: 'Não foi possível substituir o horário.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openReplaceModal = (schedule: EnrollmentSchedule) => {
    setReplaceSchedule(schedule);
    setReplaceWithClassGroupId('');
    setShowReplaceModal(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Gerenciar Horários
            </DialogTitle>
            <DialogDescription>
              Adicione, remova ou substitua os dias e horários de <strong>{student?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Este aluno não possui matrículas ativas.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {enrollments.map((enrollment) => {
                const schedules = getSchedulesForEnrollment(enrollment.id);
                const classGroup = enrollment.class_group;
                const courseName = classGroup?.course?.name || 'Curso';
                
                return (
                  <Card key={enrollment.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-sm">
                            {courseName}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {schedules.length} dia(s)
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEnrollmentId(enrollment.id);
                            setShowAddSchedule(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar Dia
                        </Button>
                      </div>

                      {schedules.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum horário configurado. Use o turno principal da matrícula.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {schedules.map((es) => {
                            const cg = es.class_group;
                            const schedule = cg?.schedule;
                            
                            return (
                              <div 
                                key={es.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium text-sm">
                                      {schedule?.day_of_week || 'Dia não definido'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {schedule ? `${schedule.start_time} - ${schedule.end_time}` : 'Horário não definido'}
                                      {cg?.name && ` • ${cg.name}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openReplaceModal(es)}
                                    title="Substituir horário"
                                    className="h-8 w-8"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setScheduleToRemove(es)}
                                    title="Remover horário"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Schedule Modal */}
      <Dialog open={showAddSchedule} onOpenChange={setShowAddSchedule}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Dia/Horário</DialogTitle>
            <DialogDescription>
              Selecione um novo dia e horário para o aluno
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Turma/Horário</Label>
              {(() => {
                const enrollment = enrollments.find(e => e.id === selectedEnrollmentId);
                const courseId = enrollment?.class_group?.course_id;
                const existingIds = getSchedulesForEnrollment(selectedEnrollmentId).map(s => s.class_group_id);
                const available = courseId ? getAvailableClassGroupsForCourse(courseId, existingIds) : [];
                
                return (
                  <Select value={selectedNewClassGroupId} onValueChange={setSelectedNewClassGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum horário disponível
                        </div>
                      ) : (
                        available.map((cg) => (
                          <SelectItem key={cg.id} value={cg.id}>
                            {cg.schedule?.day_of_week} • {cg.schedule?.start_time} - {cg.schedule?.end_time} ({cg.name})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSchedule(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleAddSchedule} disabled={isSaving || !selectedNewClassGroupId}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Schedule Modal */}
      <Dialog open={showReplaceModal} onOpenChange={setShowReplaceModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Substituir Horário</DialogTitle>
            <DialogDescription>
              Substitua o horário atual por outro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {replaceSchedule && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Horário atual:</p>
                <p className="font-medium text-sm">
                  {replaceSchedule.class_group?.schedule?.day_of_week} • {replaceSchedule.class_group?.schedule?.start_time} - {replaceSchedule.class_group?.schedule?.end_time}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Novo Horário</Label>
              {(() => {
                const enrollment = enrollments.find(e => e.id === replaceSchedule?.enrollment_id);
                const courseId = enrollment?.class_group?.course_id;
                const existingIds = getSchedulesForEnrollment(replaceSchedule?.enrollment_id || '')
                  .filter(s => s.id !== replaceSchedule?.id)
                  .map(s => s.class_group_id);
                const available = courseId ? getAvailableClassGroupsForCourse(courseId, existingIds) : [];
                
                return (
                  <Select value={replaceWithClassGroupId} onValueChange={setReplaceWithClassGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o novo horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum horário disponível
                        </div>
                      ) : (
                        available.map((cg) => (
                          <SelectItem key={cg.id} value={cg.id}>
                            {cg.schedule?.day_of_week} • {cg.schedule?.start_time} - {cg.schedule?.end_time} ({cg.name})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReplaceModal(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleReplaceSchedule} disabled={isSaving || !replaceWithClassGroupId}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Substituir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Schedule */}
      <AlertDialog open={!!scheduleToRemove} onOpenChange={() => setScheduleToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Horário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este dia/horário?
              {scheduleToRemove?.class_group?.schedule && (
                <span className="block mt-2 font-medium">
                  {scheduleToRemove.class_group.schedule.day_of_week} • {scheduleToRemove.class_group.schedule.start_time} - {scheduleToRemove.class_group.schedule.end_time}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveSchedule}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
