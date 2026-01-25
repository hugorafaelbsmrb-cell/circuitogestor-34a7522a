import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, User, Users, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { isValidCPF, isValidEmail, formatCPF, formatPhone, formatCEP } from '@/utils/validators';

interface Course {
  id: string;
  name: string;
}

interface Branding {
  system_name: string;
  system_logo: string;
}

export default function PreEnrollmentForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [branding, setBranding] = useState<Branding>({ system_name: '', system_logo: '' });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    // Guardian
    guardian_name: '',
    guardian_cpf: '',
    guardian_email: '',
    guardian_phone: '',
    guardian_address: '',
    guardian_address_number: '',
    guardian_province: '',
    guardian_postal_code: '',
    // Student
    student_name: '',
    student_birth_date: '',
    student_sex: 'M',
    // Interest
    interested_course_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchPublicData();
  }, []);

  const fetchPublicData = async () => {
    setIsLoadingData(true);
    
    // Fetch courses (public policy allows viewing active courses)
    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (coursesData) {
      setCourses(coursesData);
    }

    // Fetch branding
    const { data: brandingData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['system_name', 'system_logo']);
    
    if (brandingData) {
      const brandingObj: Branding = { system_name: '', system_logo: '' };
      brandingData.forEach(item => {
        if (item.key === 'system_name') brandingObj.system_name = item.value || '';
        if (item.key === 'system_logo') brandingObj.system_logo = item.value || '';
      });
      setBranding(brandingObj);
    }

    setIsLoadingData(false);
  };

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'guardian_cpf') {
      formattedValue = formatCPF(value);
    } else if (field === 'guardian_phone') {
      formattedValue = formatPhone(value);
    } else if (field === 'guardian_postal_code') {
      formattedValue = formatCEP(value);
    }
    
    setForm(prev => ({ ...prev, [field]: formattedValue }));
    
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Guardian validations
    if (!form.guardian_name.trim()) {
      newErrors.guardian_name = 'Nome do responsável é obrigatório';
    }
    if (!form.guardian_cpf.trim()) {
      newErrors.guardian_cpf = 'CPF é obrigatório';
    } else if (!isValidCPF(form.guardian_cpf)) {
      newErrors.guardian_cpf = 'CPF inválido';
    }
    if (form.guardian_email && !isValidEmail(form.guardian_email)) {
      newErrors.guardian_email = 'E-mail inválido';
    }
    if (!form.guardian_phone.trim()) {
      newErrors.guardian_phone = 'Telefone é obrigatório';
    } else if (form.guardian_phone.replace(/\D/g, '').length < 10) {
      newErrors.guardian_phone = 'Telefone inválido';
    }

    // Student validations
    if (!form.student_name.trim()) {
      newErrors.student_name = 'Nome do aluno é obrigatório';
    }
    if (!form.student_birth_date) {
      newErrors.student_birth_date = 'Data de nascimento é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('pre-enrollment', {
        body: form,
      });

      if (error) {
        console.error('Error submitting form:', error);
        setErrors({ submit: error.message || 'Erro ao enviar formulário' });
      } else if (data?.error) {
        setErrors({ submit: data.error });
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      console.error('Error:', err);
      setErrors({ submit: 'Erro ao enviar formulário. Tente novamente.' });
    }

    setIsSubmitting(false);
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Pré-matrícula enviada!
            </h2>
            <p className="text-muted-foreground mb-6">
              Recebemos seus dados com sucesso. Em breve nossa equipe entrará em contato para finalizar a matrícula.
            </p>
            <p className="text-sm text-muted-foreground">
              Você pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {branding.system_logo ? (
            <img 
              src={branding.system_logo} 
              alt={branding.system_name || 'Logo'} 
              className="h-16 mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {branding.system_name || 'Pré-Matrícula'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Preencha os dados abaixo para iniciar a matrícula
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guardian Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                Dados do Responsável
              </CardTitle>
              <CardDescription>
                Informações do responsável financeiro e legal do aluno
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="guardian_name">Nome Completo *</Label>
                  <Input
                    id="guardian_name"
                    value={form.guardian_name}
                    onChange={(e) => handleChange('guardian_name', e.target.value)}
                    placeholder="Nome do responsável"
                    className={errors.guardian_name ? 'border-destructive' : ''}
                  />
                  {errors.guardian_name && (
                    <p className="text-sm text-destructive mt-1">{errors.guardian_name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="guardian_cpf">CPF *</Label>
                  <Input
                    id="guardian_cpf"
                    value={form.guardian_cpf}
                    onChange={(e) => handleChange('guardian_cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={errors.guardian_cpf ? 'border-destructive' : ''}
                  />
                  {errors.guardian_cpf && (
                    <p className="text-sm text-destructive mt-1">{errors.guardian_cpf}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="guardian_phone">Telefone/WhatsApp *</Label>
                  <Input
                    id="guardian_phone"
                    value={form.guardian_phone}
                    onChange={(e) => handleChange('guardian_phone', e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className={errors.guardian_phone ? 'border-destructive' : ''}
                  />
                  {errors.guardian_phone && (
                    <p className="text-sm text-destructive mt-1">{errors.guardian_phone}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="guardian_email">E-mail</Label>
                  <Input
                    id="guardian_email"
                    type="email"
                    value={form.guardian_email}
                    onChange={(e) => handleChange('guardian_email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className={errors.guardian_email ? 'border-destructive' : ''}
                  />
                  {errors.guardian_email && (
                    <p className="text-sm text-destructive mt-1">{errors.guardian_email}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="guardian_address">Endereço</Label>
                  <Input
                    id="guardian_address"
                    value={form.guardian_address}
                    onChange={(e) => handleChange('guardian_address', e.target.value)}
                    placeholder="Rua, Avenida..."
                  />
                </div>

                <div>
                  <Label htmlFor="guardian_address_number">Número</Label>
                  <Input
                    id="guardian_address_number"
                    value={form.guardian_address_number}
                    onChange={(e) => handleChange('guardian_address_number', e.target.value)}
                    placeholder="Nº"
                  />
                </div>

                <div>
                  <Label htmlFor="guardian_province">Bairro</Label>
                  <Input
                    id="guardian_province"
                    value={form.guardian_province}
                    onChange={(e) => handleChange('guardian_province', e.target.value)}
                    placeholder="Bairro"
                  />
                </div>

                <div>
                  <Label htmlFor="guardian_postal_code">CEP</Label>
                  <Input
                    id="guardian_postal_code"
                    value={form.guardian_postal_code}
                    onChange={(e) => handleChange('guardian_postal_code', e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" />
                Dados do Aluno
              </CardTitle>
              <CardDescription>
                Informações do aluno que será matriculado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="student_name">Nome Completo *</Label>
                  <Input
                    id="student_name"
                    value={form.student_name}
                    onChange={(e) => handleChange('student_name', e.target.value)}
                    placeholder="Nome do aluno"
                    className={errors.student_name ? 'border-destructive' : ''}
                  />
                  {errors.student_name && (
                    <p className="text-sm text-destructive mt-1">{errors.student_name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="student_birth_date">Data de Nascimento *</Label>
                  <Input
                    id="student_birth_date"
                    type="date"
                    value={form.student_birth_date}
                    onChange={(e) => handleChange('student_birth_date', e.target.value)}
                    className={errors.student_birth_date ? 'border-destructive' : ''}
                  />
                  {errors.student_birth_date && (
                    <p className="text-sm text-destructive mt-1">{errors.student_birth_date}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="student_sex">Sexo</Label>
                  <Select 
                    value={form.student_sex} 
                    onValueChange={(value) => handleChange('student_sex', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Interest */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="w-5 h-5 text-primary" />
                Curso de Interesse
              </CardTitle>
              <CardDescription>
                Selecione o curso desejado (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="interested_course_id">Curso</Label>
                <Select 
                  value={form.interested_course_id} 
                  onValueChange={(value) => handleChange('interested_course_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Alguma informação adicional que gostaria de compartilhar?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full h-12 text-lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Pré-Matrícula'
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao enviar, você concorda em ser contatado pela nossa equipe.
          </p>
        </form>
      </div>
    </div>
  );
}
