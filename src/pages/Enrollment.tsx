import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, User, Users, BookOpen, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchool } from '@/contexts/SchoolContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type Step = 'student' | 'guardian' | 'course' | 'schedule' | 'contract';

const steps: { id: Step; title: string; icon: React.ElementType }[] = [
  { id: 'student', title: 'Aluno', icon: User },
  { id: 'guardian', title: 'Responsável', icon: Users },
  { id: 'course', title: 'Curso', icon: BookOpen },
  { id: 'schedule', title: 'Horário', icon: Calendar },
  { id: 'contract', title: 'Contrato', icon: FileText },
];

export default function Enrollment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { courses, classGroups, schedules, addStudent, addGuardian, addEnrollment, getCourseById, getScheduleById } = useSchool();
  
  const [currentStep, setCurrentStep] = useState<Step>('student');
  const [formData, setFormData] = useState({
    student: { name: '', birthDate: '' },
    guardian: { name: '', cpf: '', email: '', phone: '', address: '' },
    courseId: '',
    classGroupId: '',
  });

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleStudentChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      student: { ...prev.student, [field]: value }
    }));
  };

  const handleGuardianChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      guardian: { ...prev.guardian, [field]: value }
    }));
  };

  const validateStudent = () => {
    return formData.student.name.trim() !== '' && formData.student.birthDate !== '';
  };

  const validateGuardian = () => {
    const { name, cpf, email, phone, address } = formData.guardian;
    return name.trim() !== '' && cpf.trim() !== '' && email.trim() !== '' && phone.trim() !== '' && address.trim() !== '';
  };

  const goToNextStep = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id);
    }
  };

  const goToPreviousStep = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  };

  const handleSubmit = () => {
    const guardian = addGuardian(formData.guardian);
    const student = addStudent({
      name: formData.student.name,
      birthDate: formData.student.birthDate,
      guardianId: guardian.id,
    });

    addEnrollment({
      studentId: student.id,
      classGroupId: formData.classGroupId,
      guardianId: guardian.id,
      enrollmentDate: new Date().toISOString(),
      status: 'active',
      contractGenerated: true,
    });

    toast({
      title: "Matrícula realizada com sucesso!",
      description: "O contrato foi gerado e está disponível para download.",
    });

    navigate('/contratos');
  };

  const selectedCourse = getCourseById(formData.courseId);
  const availableClassGroups = classGroups.filter(cg => 
    cg.courseId === formData.courseId && cg.currentStudents < cg.maxStudents
  );
  const selectedClassGroup = classGroups.find(cg => cg.id === formData.classGroupId);
  const selectedSchedule = selectedClassGroup ? getScheduleById(selectedClassGroup.scheduleId) : undefined;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Nova Matrícula</h1>
        <p className="page-subtitle">Preencha os dados para realizar a matrícula</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
                  index < currentStepIndex ? 'bg-success text-success-foreground' :
                  index === currentStepIndex ? 'bg-primary text-primary-foreground' :
                  'bg-secondary text-muted-foreground'
                )}>
                  {index < currentStepIndex ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={cn(
                  'text-sm mt-2 font-medium',
                  index === currentStepIndex ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-4',
                  index < currentStepIndex ? 'bg-success' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="form-section animate-slide-up">
        {currentStep === 'student' && (
          <div>
            <h2 className="form-section-title">Dados do Aluno</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="studentName">Nome Completo</Label>
                <Input
                  id="studentName"
                  placeholder="Nome do aluno"
                  value={formData.student.name}
                  onChange={(e) => handleStudentChange('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.student.birthDate}
                  onChange={(e) => handleStudentChange('birthDate', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'guardian' && (
          <div>
            <h2 className="form-section-title">Dados do Responsável Financeiro</h2>
            <p className="text-sm text-muted-foreground mb-6">
              O contrato e cobranças serão emitidos no nome do responsável.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="guardianName">Nome Completo</Label>
                <Input
                  id="guardianName"
                  placeholder="Nome do responsável"
                  value={formData.guardian.name}
                  onChange={(e) => handleGuardianChange('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formData.guardian.cpf}
                  onChange={(e) => handleGuardianChange('cpf', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.guardian.email}
                  onChange={(e) => handleGuardianChange('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={formData.guardian.phone}
                  onChange={(e) => handleGuardianChange('phone', e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Input
                  id="address"
                  placeholder="Rua, número, bairro, cidade - UF"
                  value={formData.guardian.address}
                  onChange={(e) => handleGuardianChange('address', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'course' && (
          <div>
            <h2 className="form-section-title">Selecione o Curso</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => setFormData(prev => ({ ...prev, courseId: course.id, classGroupId: '' }))}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all duration-200',
                    formData.courseId === course.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <h3 className="font-semibold text-foreground">{course.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-muted-foreground">{course.duration}</span>
                    <span className="text-lg font-semibold text-primary">
                      R$ {course.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'schedule' && (
          <div>
            <h2 className="form-section-title">Selecione a Turma e Horário</h2>
            {selectedCourse && (
              <p className="text-sm text-muted-foreground mb-6">
                Turmas disponíveis para <strong>{selectedCourse.name}</strong>
              </p>
            )}
            <div className="space-y-4">
              {availableClassGroups.length > 0 ? (
                availableClassGroups.map((classGroup) => {
                  const schedule = getScheduleById(classGroup.scheduleId);
                  const availableSlots = classGroup.maxStudents - classGroup.currentStudents;
                  return (
                    <button
                      key={classGroup.id}
                      onClick={() => setFormData(prev => ({ ...prev, classGroupId: classGroup.id }))}
                      className={cn(
                        'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
                        formData.classGroupId === classGroup.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{classGroup.name}</h3>
                          {schedule && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {schedule.dayOfWeek} • {schedule.startTime} às {schedule.endTime}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-success">{availableSlots} vagas</span>
                          <p className="text-xs text-muted-foreground">
                            {classGroup.currentStudents}/{classGroup.maxStudents} alunos
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Não há turmas disponíveis para este curso no momento.
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'contract' && (
          <div>
            <h2 className="form-section-title">Resumo da Matrícula</h2>
            <div className="bg-secondary/30 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Aluno</h4>
                  <p className="text-foreground font-medium">{formData.student.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Nascimento: {formData.student.birthDate ? new Date(formData.student.birthDate).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Responsável Financeiro</h4>
                  <p className="text-foreground font-medium">{formData.guardian.name}</p>
                  <p className="text-sm text-muted-foreground">CPF: {formData.guardian.cpf}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Curso</h4>
                  <p className="text-foreground font-medium">{selectedCourse?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCourse?.duration}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Turma e Horário</h4>
                  <p className="text-foreground font-medium">{selectedClassGroup?.name}</p>
                  {selectedSchedule && (
                    <p className="text-sm text-muted-foreground">
                      {selectedSchedule.dayOfWeek} • {selectedSchedule.startTime} às {selectedSchedule.endTime}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-foreground">Valor Mensal</span>
                  <span className="text-2xl font-semibold text-primary">
                    R$ {selectedCourse?.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-success/10 rounded-xl p-4 flex items-start gap-3">
              <Check className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Contrato será gerado automaticamente</p>
                <p className="text-sm text-muted-foreground">
                  Ao finalizar, o contrato será emitido no nome do responsável financeiro.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0}
          >
            Voltar
          </Button>
          
          {currentStep === 'contract' ? (
            <Button onClick={handleSubmit} className="gap-2">
              <FileText className="w-4 h-4" />
              Finalizar e Gerar Contrato
            </Button>
          ) : (
            <Button 
              onClick={goToNextStep}
              disabled={
                (currentStep === 'student' && !validateStudent()) ||
                (currentStep === 'guardian' && !validateGuardian()) ||
                (currentStep === 'course' && !formData.courseId) ||
                (currentStep === 'schedule' && !formData.classGroupId)
              }
              className="gap-2"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
