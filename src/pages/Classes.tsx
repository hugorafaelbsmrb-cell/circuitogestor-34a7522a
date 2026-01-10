import { useState } from 'react';
import { GraduationCap, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { useSchool, ClassGroup } from '@/contexts/SchoolContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Classes() {
  const { classGroups, courses, schedules, getCourseById, getScheduleById, addClassGroup, updateClassGroup, deleteClassGroup } = useSchool();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    course_id: '',
    schedule_id: '',
    max_students: '',
  });

  const resetForm = () => {
    setFormData({ name: '', course_id: '', schedule_id: '', max_students: '' });
    setEditingClass(null);
  };

  const handleOpenDialog = (classGroup?: ClassGroup) => {
    if (classGroup) {
      setEditingClass(classGroup);
      setFormData({
        name: classGroup.name,
        course_id: classGroup.course_id,
        schedule_id: classGroup.schedule_id,
        max_students: classGroup.max_students.toString(),
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const classData = {
      name: formData.name,
      course_id: formData.course_id,
      schedule_id: formData.schedule_id,
      max_students: parseInt(formData.max_students) || 0,
    };

    if (editingClass) {
      updateClassGroup(editingClass.id, classData);
    } else {
      addClassGroup(classData);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta turma?')) {
      deleteClassGroup(id);
    }
  };

  const filteredSchedules = formData.course_id 
    ? schedules.filter(s => s.course_id === formData.course_id)
    : schedules;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Turmas</h1>
          <p className="page-subtitle">Visualize e gerencie as turmas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Turma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClass ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Turma</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Turma A - Inglês Básico"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Curso</Label>
                <Select 
                  value={formData.course_id} 
                  onValueChange={(value) => setFormData({ ...formData, course_id: value, schedule_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Select 
                  value={formData.schedule_id} 
                  onValueChange={(value) => setFormData({ ...formData, schedule_id: value })}
                  disabled={!formData.course_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.course_id ? "Selecione o horário" : "Selecione um curso primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSchedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.day_of_week} - {schedule.start_time} às {schedule.end_time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_students">Máximo de Alunos</Label>
                <Input
                  id="max_students"
                  type="number"
                  value={formData.max_students}
                  onChange={(e) => setFormData({ ...formData, max_students: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingClass ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classGroups.map((classGroup) => {
          const course = getCourseById(classGroup.course_id);
          const schedule = getScheduleById(classGroup.schedule_id);
          const occupancyPercent = (classGroup.current_students / classGroup.max_students) * 100;
          const availableSlots = classGroup.max_students - classGroup.current_students;

          return (
            <div key={classGroup.id} className="bg-card rounded-xl border border-border/50 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    availableSlots > 5 ? 'bg-success/10 text-success' :
                    availableSlots > 0 ? 'bg-warning/10 text-warning' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {availableSlots > 0 ? `${availableSlots} vagas` : 'Lotada'}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(classGroup)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(classGroup.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <h3 className="font-semibold text-foreground mb-1">{classGroup.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{course?.name}</p>

              {schedule && (
                <div className="bg-secondary/30 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-foreground">{schedule.day_of_week}</p>
                  <p className="text-sm text-muted-foreground">
                    {schedule.start_time} às {schedule.end_time}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Alunos
                  </span>
                  <span className="font-medium text-foreground">
                    {classGroup.current_students}/{classGroup.max_students}
                  </span>
                </div>
                <Progress value={occupancyPercent} className="h-2" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
