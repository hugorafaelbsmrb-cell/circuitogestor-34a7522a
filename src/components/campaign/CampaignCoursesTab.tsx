import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAIProvider } from '@/hooks/useAIProvider';
import { 
  Loader2, 
  Save, 
  Sparkles,
  BookOpen,
  Pencil,
} from 'lucide-react';

interface Course {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  price: number;
  is_active: boolean | null;
}

interface CampaignCoursesTabProps {
  courses: Course[];
  onCoursesChange: (courses: Course[]) => void;
}

export function CampaignCoursesTab({ courses, onCoursesChange }: CampaignCoursesTabProps) {
  const { getGenerateFunctionName } = useAIProvider();
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isGeneratingCourseDesc, setIsGeneratingCourseDesc] = useState(false);
  const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
  const aiCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseInvokeError = (err: any) => {
    try {
      if (err?.context?.body) return { status: err.context.status, body: JSON.parse(err.context.body) };
      if (typeof err?.message === 'string') return { status: 500, body: { error: err.message } };
    } catch { /* ignore */ }
    return { status: 500, body: { error: 'Erro desconhecido' } };
  };

  const getCooldownText = () => {
    if (!aiCooldownUntil) return null;
    const remaining = Math.ceil((aiCooldownUntil - Date.now()) / 1000);
    return remaining > 0 ? `Aguarde ${remaining}s` : null;
  };

  const handleSaveCourse = async (course: Course) => {
    setIsSavingCourse(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          name: course.name,
          description: course.description,
          duration: course.duration,
          price: course.price,
          is_active: course.is_active,
        })
        .eq('id', course.id);

      if (error) throw error;

      onCoursesChange(courses.map(c => c.id === course.id ? course : c));
      setEditingCourse(null);
      toast.success('Curso atualizado!');
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error('Erro ao salvar curso');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleToggleCourseActive = async (course: Course) => {
    try {
      const newValue = !course.is_active;
      const { error } = await supabase
        .from('courses')
        .update({ is_active: newValue })
        .eq('id', course.id);

      if (error) throw error;

      onCoursesChange(courses.map(c => c.id === course.id ? { ...c, is_active: newValue } : c));
      toast.success(newValue ? 'Curso ativado!' : 'Curso desativado!');
    } catch (error) {
      console.error('Error toggling course:', error);
      toast.error('Erro ao atualizar curso');
    }
  };

  const handleGenerateCourseDescription = async () => {
    if (!editingCourse) return;
    
    if (aiCooldownUntil && Date.now() < aiCooldownUntil) {
      toast.error('Aguarde para tentar novamente');
      return;
    }

    setIsGeneratingCourseDesc(true);
    try {
      const prompt = `Crie uma descrição atraente e persuasiva (máximo 80 palavras) para um curso chamado "${editingCourse.name}" com duração de ${editingCourse.duration} para uma escola de cursos extracurriculares. A descrição deve destacar benefícios para crianças/jovens e convencer os pais a matricular seus filhos. Responda APENAS com a descrição, sem aspas ou explicações.`;

      const functionName = getGenerateFunctionName();
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          purpose: prompt,
          tone: 'profissional e envolvente',
          context: 'landing page de captação de leads para escola',
        },
      });

      if (error) throw error;

      if (data?.message) {
        const generatedText = data.message.trim().replace(/^["']|["']$/g, '');
        setEditingCourse({ ...editingCourse, description: generatedText });
        toast.success('Descrição gerada!');
      } else {
        throw new Error('Nenhum texto gerado');
      }
    } catch (error: any) {
      const parsed = parseInvokeError(error);
      
      if (parsed.status === 429) {
        const retryAfterSeconds = Number(parsed.body?.retry_after_seconds ?? 60);
        const ms = Math.min(Math.max(retryAfterSeconds, 5), 600) * 1000;
        setAiCooldownUntil(Date.now() + ms);
        if (aiCooldownTimeoutRef.current) clearTimeout(aiCooldownTimeoutRef.current);
        aiCooldownTimeoutRef.current = setTimeout(() => setAiCooldownUntil(null), ms);
        toast.error('Limite de requisições atingido. Aguarde um momento.');
        return;
      }

      console.error('Error generating course description:', error);
      toast.error(parsed.body?.error || 'Erro ao gerar descrição');
    } finally {
      setIsGeneratingCourseDesc(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Cursos da Landing Page</CardTitle>
        <CardDescription>Edite os cursos exibidos na página de captação</CardDescription>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhum curso cadastrado</p>
            <p className="text-sm">Cadastre cursos na página de Cursos do sistema</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <div 
                key={course.id} 
                className={`p-4 border rounded-lg transition-all ${
                  course.is_active ? 'border-border bg-card' : 'border-muted bg-muted/30 opacity-60'
                }`}
              >
                {editingCourse?.id === course.id ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome do Curso</Label>
                        <Input
                          value={editingCourse.name}
                          onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duração</Label>
                        <Input
                          value={editingCourse.duration}
                          onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                          placeholder="Ex: 12 meses"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Descrição</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateCourseDescription}
                          disabled={isGeneratingCourseDesc || !!getCooldownText()}
                          className="gap-1.5 h-7 text-xs"
                        >
                          {isGeneratingCourseDesc ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {getCooldownText() || 'Gerar com IA'}
                        </Button>
                      </div>
                      <Textarea
                        value={editingCourse.description || ''}
                        onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                        placeholder="Descrição do curso..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Preço (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingCourse.price}
                          onChange={(e) => setEditingCourse({ ...editingCourse, price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={editingCourse.is_active ?? true}
                          onCheckedChange={(checked) => setEditingCourse({ ...editingCourse, is_active: checked })}
                        />
                        <Label>Exibir na landing page</Label>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={() => handleSaveCourse(editingCourse)}
                        disabled={isSavingCourse}
                      >
                        {isSavingCourse ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setEditingCourse(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{course.name}</h4>
                        {!course.is_active && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">Oculto</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {course.duration} • R$ {course.price.toFixed(2)}
                      </p>
                      {course.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={course.is_active ?? true}
                        onCheckedChange={() => handleToggleCourseActive(course)}
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingCourse(course)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
