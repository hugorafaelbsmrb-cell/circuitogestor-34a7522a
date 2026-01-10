import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, User, Users, BookOpen, Calendar, FileText, CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSchool } from '@/contexts/SchoolContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { EnrollmentSummary } from '@/components/enrollment/EnrollmentSummary';
import { ContractPrintView } from '@/components/enrollment/ContractPrintView';

type Step = 'student' | 'guardian' | 'course' | 'schedule' | 'payment' | 'contract' | 'summary';

const steps: { id: Step; title: string; icon: React.ElementType }[] = [
  { id: 'student', title: 'Aluno', icon: User },
  { id: 'guardian', title: 'Responsável', icon: Users },
  { id: 'course', title: 'Curso', icon: BookOpen },
  { id: 'schedule', title: 'Horário', icon: Calendar },
  { id: 'payment', title: 'Pagamento', icon: CreditCard },
  { id: 'contract', title: 'Contrato', icon: FileText },
  { id: 'summary', title: 'Conclusão', icon: CheckCircle },
];

export default function Enrollment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    courses, 
    classGroups, 
    schedules,
    contractConfig,
    contractClauses,
    createStudent, 
    createGuardian, 
    createEnrollment,
    createContract,
    createPayment,
    createCarne,
    updateEnrollment,
    getCourseById, 
    getScheduleById,
    isLoading: isDataLoading
  } = useSchool();
  
  const { isLoading: isAsaasLoading, createCustomer, createCarne: createAsaasCarne, createPayment: createAsaasPayment, getInstallmentBooklet } = useAsaasPayment();
  
  const [currentStep, setCurrentStep] = useState<Step>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCarne, setIsLoadingCarne] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<{
    contract: { id: string; content: any } | null;
    carne: { id: string; asaasInstallmentId: string } | null;
  } | null>(null);
  
  const contractPrintRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    student: { name: '', birthDate: '' },
    guardian: { 
      name: '', 
      cpf: '', 
      email: '', 
      phone: '', 
      address: '',
      addressNumber: '',
      province: '',
      postalCode: ''
    },
    courseId: '',
    classGroupId: '',
    payment: {
      installments: '6',
      dueDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
    }
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

  const handlePaymentChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      payment: { ...prev.payment, [field]: value }
    }));
  };

  const validateStudent = () => {
    return formData.student.name.trim() !== '' && formData.student.birthDate !== '';
  };

  const validateGuardian = () => {
    const { name, cpf, email, phone, address, postalCode } = formData.guardian;
    return name.trim() !== '' && cpf.trim() !== '' && email.trim() !== '' && phone.trim() !== '' && address.trim() !== '' && postalCode.trim() !== '';
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

  const handleSubmit = async () => {
    if (!selectedCourse || !selectedClassGroup) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. Create Guardian in database
      const guardian = await createGuardian({
        name: formData.guardian.name,
        cpf: formData.guardian.cpf,
        email: formData.guardian.email,
        phone: formData.guardian.phone,
        address: formData.guardian.address,
        address_number: formData.guardian.addressNumber || 'S/N',
        province: formData.guardian.province || 'Centro',
        postal_code: formData.guardian.postalCode.replace(/\D/g, ''),
        asaas_customer_id: null,
      });

      // 2. Create Student in database
      const student = await createStudent({
        name: formData.student.name,
        birth_date: formData.student.birthDate,
        guardian_id: guardian.id,
      });

      // 3. Create Enrollment in database
      const enrollment = await createEnrollment({
        student_id: student.id,
        class_group_id: formData.classGroupId,
        guardian_id: guardian.id,
        status: 'active',
      });

      // 4. Generate Contract
      const contractContent = {
        schoolName: contractConfig?.school_name || 'EduGestor',
        schoolCnpj: contractConfig?.school_cnpj || '',
        schoolAddress: contractConfig?.school_address || '',
        guardianName: guardian.name,
        guardianCpf: guardian.cpf,
        guardianAddress: guardian.address,
        studentName: student.name,
        studentBirthDate: student.birth_date,
        courseName: selectedCourse.name,
        courseDuration: selectedCourse.duration,
        coursePrice: selectedCourse.price,
        classGroupName: selectedClassGroup.name,
        schedule: selectedSchedule ? `${selectedSchedule.day_of_week} - ${selectedSchedule.start_time} às ${selectedSchedule.end_time}` : '',
        installments: parseInt(formData.payment.installments),
        installmentValue: selectedCourse.price,
        totalValue: selectedCourse.price * parseInt(formData.payment.installments),
        clauses: contractClauses.filter(c => c.is_active).map(c => ({
          title: c.title,
          content: c.content,
        })),
        createdAt: new Date().toISOString(),
      };

      const contract = await createContract({
        enrollment_id: enrollment.id,
        guardian_id: guardian.id,
        student_id: student.id,
        course_id: selectedCourse.id,
        contract_content: contractContent,
        total_value: contractContent.totalValue,
        installment_count: contractContent.installments,
      });

      // 5. Create Customer in Asaas
      const asaasCustomer = await createCustomer({
        name: guardian.name,
        cpfCnpj: guardian.cpf,
        email: guardian.email,
        phone: guardian.phone,
        address: guardian.address,
        addressNumber: formData.guardian.addressNumber || 'S/N',
        province: formData.guardian.province || 'Centro',
        postalCode: guardian.postal_code,
      });

      if (!asaasCustomer) {
        throw new Error('Erro ao criar cliente no sistema de pagamentos');
      }

      // 6. Generate Carnê in Asaas
      const installmentCount = parseInt(formData.payment.installments);
      const description = `Mensalidade - ${selectedCourse.name} - Aluno: ${student.name}`;
      
      const asaasPayment = await createAsaasCarne({
        customerId: asaasCustomer.id,
        value: selectedCourse.price * installmentCount,
        dueDate: formData.payment.dueDate,
        description,
        installmentCount,
        externalReference: enrollment.id,
      });

      let carneData = null;
      
      if (asaasPayment) {
        // Save carnê to database
        const savedCarne = await createCarne({
          enrollment_id: enrollment.id,
          guardian_id: guardian.id,
          contract_id: contract.id,
          asaas_installment_id: asaasPayment.installment || asaasPayment.id,
          description,
          total_value: selectedCourse.price * installmentCount,
          installment_count: installmentCount,
          first_due_date: formData.payment.dueDate,
        });

        carneData = {
          id: savedCarne.id,
          asaasInstallmentId: asaasPayment.installment || asaasPayment.id,
        };

        // Save the first payment record
        await createPayment({
          enrollment_id: enrollment.id,
          guardian_id: guardian.id,
          contract_id: contract.id,
          asaas_payment_id: asaasPayment.id,
          asaas_installment_id: asaasPayment.installment || null,
          description,
          value: asaasPayment.value,
          due_date: asaasPayment.dueDate,
          status: asaasPayment.status,
          invoice_url: asaasPayment.invoiceUrl,
          bank_slip_url: asaasPayment.bankSlipUrl,
          installment_number: 1,
          external_reference: enrollment.id,
        });
      }

      // 7. Update enrollment with contract flag
      await updateEnrollment(enrollment.id, { contract_generated: true });

      // Set enrollment result for summary
      setEnrollmentResult({
        contract: {
          id: contract.id,
          content: contractContent,
        },
        carne: carneData,
      });

      toast({
        title: "Matrícula realizada com sucesso!",
        description: "O contrato e o carnê foram gerados automaticamente.",
      });

      // Go to summary step instead of navigating away
      setCurrentStep('summary');
    } catch (error) {
      console.error('Enrollment error:', error);
      toast({
        title: "Erro na matrícula",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao processar a matrícula.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler functions for summary actions
  const handlePrintContract = () => {
    if (contractPrintRef.current) {
      const printContent = contractPrintRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Contrato de Matrícula</title>
            <style>
              body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; }
              * { box-sizing: border-box; }
              .font-bold { font-weight: bold; }
              .text-center { text-align: center; }
              .text-justify { text-align: justify; }
              .mb-2 { margin-bottom: 8px; }
              .mb-4 { margin-bottom: 16px; }
              .mb-6 { margin-bottom: 24px; }
              .mb-8 { margin-bottom: 32px; }
              .mb-12 { margin-bottom: 48px; }
              .mt-12 { margin-top: 48px; }
              .mt-16 { margin-top: 64px; }
              .p-4 { padding: 16px; }
              .pt-2 { padding-top: 8px; }
              .border { border: 1px solid #ccc; }
              .border-t { border-top: 1px solid #000; }
              .border-black { border-color: #000; }
              .border-gray-300 { border-color: #ccc; }
              .rounded { border-radius: 4px; }
              .leading-relaxed { line-height: 1.6; }
              .text-sm { font-size: 14px; }
              .text-xl { font-size: 20px; }
              .text-2xl { font-size: 24px; }
              .uppercase { text-transform: uppercase; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .w-2\\/5 { width: 40%; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    } else {
      // If modal not open, open it first
      setShowContractModal(true);
      setTimeout(() => {
        handlePrintContract();
      }, 500);
    }
  };

  const handleViewCarne = async () => {
    if (!enrollmentResult?.carne?.asaasInstallmentId) {
      toast({
        title: "Erro",
        description: "Carnê não encontrado",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingCarne(true);
    try {
      const booklet = await getInstallmentBooklet(enrollmentResult.carne.asaasInstallmentId);
      if (booklet?.url) {
        window.open(booklet.url, '_blank');
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível obter o carnê",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingCarne(false);
    }
  };

  const handleDownloadCarne = async () => {
    if (!enrollmentResult?.carne?.asaasInstallmentId) {
      toast({
        title: "Erro",
        description: "Carnê não encontrado",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingCarne(true);
    try {
      const booklet = await getInstallmentBooklet(enrollmentResult.carne.asaasInstallmentId);
      if (booklet?.url) {
        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = booklet.url;
        link.target = '_blank';
        link.download = `carne_${enrollmentResult.carne.asaasInstallmentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível baixar o carnê",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingCarne(false);
    }
  };

  const handleNewEnrollment = () => {
    // Reset form
    setFormData({
      student: { name: '', birthDate: '' },
      guardian: { 
        name: '', 
        cpf: '', 
        email: '', 
        phone: '', 
        address: '',
        addressNumber: '',
        province: '',
        postalCode: ''
      },
      courseId: '',
      classGroupId: '',
      payment: {
        installments: '6',
        dueDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
      }
    });
    setEnrollmentResult(null);
    setCurrentStep('student');
  };

  const selectedCourse = getCourseById(formData.courseId);
  const availableClassGroups = classGroups.filter(cg => 
    cg.course_id === formData.courseId && cg.current_students < cg.max_students
  );
  const selectedClassGroup = classGroups.find(cg => cg.id === formData.classGroupId);
  const selectedSchedule = selectedClassGroup ? getScheduleById(selectedClassGroup.schedule_id) : undefined;

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Rua, Avenida..."
                  value={formData.guardian.address}
                  onChange={(e) => handleGuardianChange('address', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressNumber">Número</Label>
                <Input
                  id="addressNumber"
                  placeholder="123"
                  value={formData.guardian.addressNumber}
                  onChange={(e) => handleGuardianChange('addressNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Bairro</Label>
                <Input
                  id="province"
                  placeholder="Centro"
                  value={formData.guardian.province}
                  onChange={(e) => handleGuardianChange('province', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">CEP</Label>
                <Input
                  id="postalCode"
                  placeholder="00000-000"
                  value={formData.guardian.postalCode}
                  onChange={(e) => handleGuardianChange('postalCode', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'course' && (
          <div>
            <h2 className="form-section-title">Selecione o Curso</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.filter(c => c.is_active).map((course) => (
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
                      R$ {Number(course.price).toFixed(2).replace('.', ',')}
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
                  const schedule = getScheduleById(classGroup.schedule_id);
                  const availableSlots = classGroup.max_students - classGroup.current_students;
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
                              {schedule.day_of_week} • {schedule.start_time} às {schedule.end_time}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-success">{availableSlots} vagas</span>
                          <p className="text-xs text-muted-foreground">
                            {classGroup.current_students}/{classGroup.max_students} alunos
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

        {currentStep === 'payment' && (
          <div>
            <h2 className="form-section-title">Configuração do Carnê</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure o parcelamento e a data de vencimento das mensalidades.
            </p>
            
            {selectedCourse && (
              <div className="bg-secondary/30 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Curso selecionado</span>
                  <span className="font-semibold">{selectedCourse.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor por mensalidade</span>
                  <span className="font-semibold text-primary">
                    R$ {Number(selectedCourse.price).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Número de Mensalidades</Label>
                <Select
                  value={formData.payment.installments}
                  onValueChange={(value) => handlePaymentChange('installments', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}x {selectedCourse && `(Total: R$ ${(Number(selectedCourse.price) * n).toFixed(2).replace('.', ',')})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primeiro Vencimento</Label>
                <Input
                  type="date"
                  value={formData.payment.dueDate}
                  onChange={(e) => handlePaymentChange('dueDate', e.target.value)}
                />
              </div>
            </div>

            {selectedCourse && (
              <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Valor Total do Carnê</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {(Number(selectedCourse.price) * parseInt(formData.payment.installments)).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {formData.payment.installments}x de R$ {Number(selectedCourse.price).toFixed(2).replace('.', ',')}
                </p>
              </div>
            )}
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
                      {selectedSchedule.day_of_week} • {selectedSchedule.start_time} às {selectedSchedule.end_time}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Mensalidade</span>
                  <span className="font-medium">
                    R$ {selectedCourse ? Number(selectedCourse.price).toFixed(2).replace('.', ',') : '0,00'}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Número de parcelas</span>
                  <span className="font-medium">{formData.payment.installments}x</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-lg font-medium text-foreground">Valor Total</span>
                  <span className="text-2xl font-semibold text-primary">
                    R$ {selectedCourse ? (Number(selectedCourse.price) * parseInt(formData.payment.installments)).toFixed(2).replace('.', ',') : '0,00'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-success/10 rounded-xl p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Contrato gerado automaticamente</p>
                  <p className="text-sm text-muted-foreground">
                    O contrato será emitido no nome do responsável financeiro.
                  </p>
                </div>
              </div>
              <div className="bg-primary/10 rounded-xl p-4 flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Carnê de pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Serão gerados {formData.payment.installments} boletos com vencimento mensal a partir de {new Date(formData.payment.dueDate).toLocaleDateString('pt-BR')}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'summary' && enrollmentResult && (
          <EnrollmentSummary
            data={{
              student: formData.student,
              guardian: formData.guardian,
              course: selectedCourse ? {
                name: selectedCourse.name,
                duration: selectedCourse.duration,
                price: selectedCourse.price,
              } : null,
              classGroup: selectedClassGroup ? { name: selectedClassGroup.name } : null,
              schedule: selectedSchedule ? {
                day_of_week: selectedSchedule.day_of_week,
                start_time: selectedSchedule.start_time,
                end_time: selectedSchedule.end_time,
              } : null,
              payment: formData.payment,
              contract: enrollmentResult.contract,
              carne: enrollmentResult.carne,
            }}
            onPrintContract={handlePrintContract}
            onViewContract={() => setShowContractModal(true)}
            onPrintCarne={handleDownloadCarne}
            onViewCarne={handleViewCarne}
            onNewEnrollment={handleNewEnrollment}
            onGoToContracts={() => navigate('/contratos')}
            isLoadingCarne={isLoadingCarne}
          />
        )}

        {/* Navigation Buttons - Hide on summary step */}
        {currentStep !== 'summary' && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStepIndex === 0 || isSubmitting}
            >
              Voltar
            </Button>
            
            {currentStep === 'contract' ? (
              <Button 
                onClick={handleSubmit} 
                className="gap-2"
                disabled={isSubmitting || isAsaasLoading}
              >
                {(isSubmitting || isAsaasLoading) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Finalizar Matrícula
                  </>
                )}
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
        )}
      </div>

      {/* Contract Print Modal */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato de Matrícula</DialogTitle>
          </DialogHeader>
          {enrollmentResult?.contract?.content && (
            <>
              <ContractPrintView ref={contractPrintRef} content={enrollmentResult.contract.content} />
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowContractModal(false)}>
                  Fechar
                </Button>
                <Button onClick={handlePrintContract}>
                  Imprimir
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
