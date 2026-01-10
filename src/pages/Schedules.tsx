import { useState } from 'react';
import { Calendar, Clock, Plus, Pencil, Trash2 } from 'lucide-react';
import { useSchool, Schedule } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Schedules() {
  const { schedules, courses, getCourseById, addSchedule, updateSchedule, deleteSchedule } = useSchool();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    course_id: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    available_slots: '',
  });

  const groupedByDay = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.day_of_week]) {
      acc[schedule.day_of_week] = [];
    }
    acc[schedule.day_of_week].push(schedule);
    return acc;
  }, {} as Record<string, typeof schedules>);

  const daysOfWeek = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Segunda e Quarta',
    'Terça e Quinta',
  ];

  const resetForm = () => {
    setFormData({ course_id: '', day_of_week: '', start_time: '', end_time: '', available_slots: '' });
    setEditingSchedule(null);
  };

  const handleOpenDialog = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        course_id: schedule.course_id,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        available_slots: schedule.available_slots.toString(),
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduleData = {
      course_id: formData.course_id,
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      available_slots: parseInt(formData.available_slots) || 0,
    };

    if (editingSchedule) {
      updateSchedule(editingSchedule.id, scheduleData);
    } else {
      addSchedule(scheduleData);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este horário?')) {
      deleteSchedule(id);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Horários</h1>
          <p className="page-subtitle">Grade de horários das turmas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Horário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSchedule ? 'Editar Horário' : 'Novo Horário'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Curso</Label>
                <Select value={formData.course_id} onValueChange={(value) => setFormData({ ...formData, course_id: value })}>
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
                <Label>Dia da Semana</Label>
                <Select value={formData.day_of_week} onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Hora Início</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Hora Término</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="available_slots">Vagas</Label>
                <Input
                  id="available_slots"
                  type="number"
                  value={formData.available_slots}
                  onChange={(e) => setFormData({ ...formData, available_slots: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingSchedule ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByDay).map(([day, daySchedules]) => (
          <div key={day} className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="bg-primary/5 px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{day}</h3>
              </div>
            </div>
            <div className="divide-y divide-border">
              {daySchedules.map((schedule) => {
                const course = getCourseById(schedule.course_id);
                return (
                  <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{course?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {schedule.start_time} às {schedule.end_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        {schedule.available_slots} vagas
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(schedule)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(schedule.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
