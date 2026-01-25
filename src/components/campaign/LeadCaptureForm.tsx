import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Course {
  id: string;
  name: string;
}

interface LeadCaptureFormProps {
  courses: Course[];
  selectedCourseId?: string;
  onSuccess?: () => void;
}

export function LeadCaptureForm({ courses, selectedCourseId, onSuccess }: LeadCaptureFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState(selectedCourseId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone mask
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let masked = digits;
    if (digits.length > 0) {
      masked = '(' + digits.slice(0, 2);
      if (digits.length > 2) {
        masked += ') ' + digits.slice(2, 7);
        if (digits.length > 7) {
          masked += '-' + digits.slice(7, 11);
        }
      }
    }
    setPhone(masked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Por favor, insira um telefone válido');
      return;
    }

    if (!name.trim()) {
      setError('Por favor, insira seu nome');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('campaign-lead', {
        body: {
          name: name.trim(),
          phone: phoneDigits,
          interested_course_id: courseId || null,
        },
      });

      if (fnError) throw fnError;

      console.log('Lead created:', data);
      setIsSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error('Error submitting lead:', err);
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Cadastro realizado! 🎉
        </h3>
        <p className="text-muted-foreground">
          Em breve você receberá uma mensagem no WhatsApp com mais informações.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-foreground font-medium">
          Seu nome
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como podemos te chamar?"
          className="h-12 text-base"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-foreground font-medium">
          WhatsApp
        </Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="(00) 00000-0000"
          className="h-12 text-base"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="course" className="text-foreground font-medium">
          Curso de interesse
        </Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Selecione um curso" />
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

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button 
        type="submit" 
        size="lg" 
        className="w-full h-14 text-lg font-semibold"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="w-5 h-5 mr-2" />
            Quero garantir minha vaga!
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Ao se cadastrar, você concorda em receber mensagens sobre nossos cursos via WhatsApp.
      </p>
    </form>
  );
}
