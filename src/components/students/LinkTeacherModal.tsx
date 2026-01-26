import { useState, useEffect } from 'react';
import { Loader2, GraduationCap, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Teacher {
  id: string;
  name: string;
  phone: string;
}

interface LinkTeacherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    name: string;
    teacher_id?: string | null;
  } | null;
  onSuccess: () => void;
}

export function LinkTeacherModal({ open, onOpenChange, student, onSuccess }: LinkTeacherModalProps) {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch teachers when modal opens
  useEffect(() => {
    if (open) {
      fetchTeachers();
      setSelectedTeacherId(student?.teacher_id || '');
    }
  }, [open, student?.teacher_id]);

  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, phone')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast({
        title: 'Erro ao carregar professores',
        description: 'Não foi possível carregar a lista de professores.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!student) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          teacher_id: selectedTeacherId === 'none' ? null : selectedTeacherId || null 
        })
        .eq('id', student.id);

      if (error) throw error;

      const teacherName = selectedTeacherId && selectedTeacherId !== 'none'
        ? teachers.find(t => t.id === selectedTeacherId)?.name
        : null;

      toast({
        title: teacherName ? 'Professor vinculado!' : 'Vínculo removido!',
        description: teacherName 
          ? `${student.name} foi vinculado(a) ao professor(a) ${teacherName}.`
          : `O vínculo de professor foi removido de ${student.name}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking teacher:', error);
      toast({
        title: 'Erro ao vincular professor',
        description: 'Não foi possível salvar o vínculo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentTeacher = student?.teacher_id 
    ? teachers.find(t => t.id === student.teacher_id) 
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Vincular Professor
          </DialogTitle>
          <DialogDescription>
            Vincule um professor ao aluno <strong>{student?.name}</strong> para envio de lições de casa e comunicações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentTeacher && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
              <UserCheck className="w-4 h-4 text-primary" />
              <span className="text-sm">
                Professor atual: <strong>{currentTeacher.name}</strong>
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="teacher">Selecionar Professor</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select 
                value={selectedTeacherId} 
                onValueChange={setSelectedTeacherId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um professor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Nenhum (remover vínculo)</span>
                  </SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {teachers.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">
                Nenhum professor cadastrado. Cadastre professores na página de Professores.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
