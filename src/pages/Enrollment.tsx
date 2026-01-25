import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, User, Users, BookOpen, Calendar, FileText, CreditCard, Loader2, CheckCircle, Percent, Tag, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/contexts/SchoolContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { EnrollmentSummary } from '@/components/enrollment/EnrollmentSummary';
import { ContractPrintView } from '@/components/enrollment/ContractPrintView';
import { supabase } from '@/integrations/supabase/client';
import { isValidCPF, isValidEmail, formatCPF, formatPhone, formatCEP, normalizePhoneToWAPI } from '@/utils/validators';

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

// Fixed schedule configuration
const WEEKDAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
const TIME_SLOTS = [
  { id: 'morning_1', label: 'Manhã 1', start: '08:30', end: '10:00', period: 'Manhã' },
  { id: 'morning_2', label: 'Manhã 2', start: '10:00', end: '11:30', period: 'Manhã' },
  { id: 'afternoon_1', label: 'Tarde 1', start: '14:00', end: '15:30', period: 'Tarde' },
  { id: 'afternoon_2', label: 'Tarde 2', start: '16:00', end: '17:30', period: 'Tarde' },
];

// Grade levels for "Reforço Escolar" course
const GRADE_LEVELS = [
  { id: 'alfabetizacao_1ano', label: 'Alfabetização e 1° Ano', description: 'Sala 1' },
  { id: '2_3_ano', label: '2° e 3° Ano', description: 'Sala 2' },
  { id: '4_5_ano', label: '4° e 5° Ano', description: 'Sala 3' },
];

// Variable pricing for "Reforço Escolar" based on days per week
const REFORCO_ESCOLAR_PRICES: Record<number, number> = {
  1: 120,
  2: 200,
  3: 250,
  4: 300,
  5: 300,
};

interface SelectedSchedule {
  dayOfWeek: string;
  timeSlot: typeof TIME_SLOTS[0];
}

export default function Enrollment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { 
    courses, 
    classGroups, 
    schedules,
    contractConfig,
    contractClauses,
    discounts,
    students,
    guardians,
    createStudent, 
    createGuardian,
    updateGuardian,
    createEnrollment,
    createContract,
    createPayment,
    createCarne,
    updateEnrollment,
    getCourseById, 
    getScheduleById,
    getGuardianByCpf,
    getStudentById,
    getGuardianById,
    isLoading: isDataLoading
  } = useSchool();
  
  const { isLoading: isAsaasLoading, createCustomer, createBoleto: createAsaasBoleto, createCarne: createAsaasCarne, getInstallmentBooklet } = useAsaasPayment();
  const { branding } = useSystemBranding();
  
  // Check if this is an enrollment for an existing student (second course flow)
  const existingStudentId = searchParams.get('studentId');
  
  const [currentStep, setCurrentStep] = useState<Step>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCarne, setIsLoadingCarne] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [isSecondCourseFlow, setIsSecondCourseFlow] = useState(false);
  const [foundGuardianId, setFoundGuardianId] = useState<string | null>(null);
  const [guardianSearched, setGuardianSearched] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<SelectedSchedule[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
  const [enrollmentResult, setEnrollmentResult] = useState<{
    contract: { id: string; content: any } | null;
    carne: { id: string; asaasInstallmentId: string } | null;
    proRataBoleto: { id: string; invoiceUrl: string | null; bankSlipUrl: string | null } | null;
  } | null>(null);
  
  const contractPrintRef = useRef<HTMLDivElement>(null);
  const [useProRata, setUseProRata] = useState(true);
  const [useEntryBoleto, setUseEntryBoleto] = useState(true); // Boleto de entrada com valor cheio
  const [generateCarneNow, setGenerateCarneNow] = useState(true); // Gerar carnê no ato da matrícula
  const [customPrice, setCustomPrice] = useState<string>(''); // Valor personalizado
  const [formData, setFormData] = useState({
    student: { 
      name: '', 
      birthDate: '',
      sex: 'M' as 'M' | 'F'
    },
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
      dueDayOfMonth: '10',
    }
  });

  // Calculate age from birth date
  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const studentAge = calculateAge(formData.student.birthDate);

  // Standard due date options
  const dueDateOptions = [5, 10, 15, 20, 25];

  // Effect to load existing student/guardian data when available (runs only once)
  useEffect(() => {
    if (existingStudentId && !isDataLoading && students.length > 0 && !isSecondCourseFlow) {
      const existingStudent = getStudentById(existingStudentId);
      if (existingStudent) {
        const existingGuardian = getGuardianById(existingStudent.guardian_id);
        
        setFormData(prev => ({
          ...prev,
          student: {
            name: existingStudent.name,
            birthDate: existingStudent.birth_date,
            sex: (existingStudent.sex as 'M' | 'F') || 'M',
          },
          guardian: existingGuardian ? {
            name: existingGuardian.name,
            cpf: existingGuardian.cpf,
            email: existingGuardian.email,
            phone: existingGuardian.phone,
            address: existingGuardian.address,
            addressNumber: existingGuardian.address_number || '',
            province: existingGuardian.province || '',
            postalCode: existingGuardian.postal_code || '',
          } : prev.guardian,
        }));
        
        setIsSecondCourseFlow(true);
        setCurrentStep('course');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingStudentId, isDataLoading, students.length > 0]);

  // Selected course
  const selectedCourse = getCourseById(formData.courseId);

  // Get available schedules for selected course
  const availableSchedulesForCourse = useMemo(() => {
    if (!formData.courseId) return [];
    return schedules.filter(s => s.course_id === formData.courseId);
  }, [formData.courseId, schedules]);

  // Find class group for selected schedule
  const findClassGroupForSchedule = (dayOfWeek: string, startTime: string) => {
    const schedule = availableSchedulesForCourse.find(
      s => s.day_of_week === dayOfWeek && s.start_time === startTime
    );
    if (!schedule) return null;
    
    return classGroups.find(
      cg => cg.schedule_id === schedule.id && cg.current_students < cg.max_students
    );
  };

  // Calculate discount values
  const activeDiscounts = discounts.filter(d => d.is_active && selectedDiscountIds.includes(d.id));
  
  // Check if course is "Reforço Escolar" for variable pricing
  const isReforcoEscolar = selectedCourse?.name.toLowerCase().includes('reforço escolar');
  
  // Get the effective price based on course type, selected days, or custom price
  const effectiveCoursePrice = useMemo(() => {
    if (!selectedCourse) return 0;
    
    // If custom price is set, use it
    const parsedCustomPrice = parseFloat(customPrice.replace(',', '.'));
    if (customPrice && !isNaN(parsedCustomPrice) && parsedCustomPrice >= 0) {
      return parsedCustomPrice;
    }
    
    if (isReforcoEscolar && selectedSchedules.length > 0) {
      // Use variable pricing based on days per week
      const daysCount = selectedSchedules.length;
      return REFORCO_ESCOLAR_PRICES[daysCount] || REFORCO_ESCOLAR_PRICES[5];
    }
    
    return Number(selectedCourse.price);
  }, [selectedCourse, isReforcoEscolar, selectedSchedules.length, customPrice]);
  
  const calculateDiscountedPrice = useMemo(() => {
    if (!selectedCourse) return { originalPrice: 0, discountedPrice: 0, totalDiscount: 0, isFullDiscount: false };
    
    const originalPrice = effectiveCoursePrice;
    let discountedPrice = originalPrice;
    let totalDiscount = 0;
    
    activeDiscounts.forEach(discount => {
      if (discount.type === 'percentage') {
        const discountAmount = (discountedPrice * discount.value) / 100;
        discountedPrice -= discountAmount;
        totalDiscount += discountAmount;
      } else {
        discountedPrice -= discount.value;
        totalDiscount += discount.value;
      }
    });
    
    discountedPrice = Math.max(0, discountedPrice);
    
    // Detect if this is a 100% discount (value is 0 or effectively 0)
    const isFullDiscount = discountedPrice <= 0 || totalDiscount >= originalPrice;
    
    return { originalPrice, discountedPrice, totalDiscount, isFullDiscount };
  }, [selectedCourse, effectiveCoursePrice, activeDiscounts]);

  // Calculate the pro-rata due date (enrollment date + a few days for processing)
  const calculateProRataDueDate = () => {
    const today = new Date();
    // Pro-rata vence 5 dias após a matrícula para dar tempo de processar
    const proRataDate = new Date(today);
    proRataDate.setDate(proRataDate.getDate() + 5);
    return proRataDate;
  };

  // Calculate the first regular installment due date (next month on selected day)
  const calculateFirstDueDate = () => {
    const today = new Date();
    const selectedDay = parseInt(formData.payment.dueDayOfMonth);
    
    // First installment is always next month from today
    let dueDate = new Date(today.getFullYear(), today.getMonth() + 1, selectedDay);
    
    return dueDate;
  };

  // Calculate pro-rata value for first installment
  const calculateProRataValue = useMemo(() => {
    if (!selectedCourse) return { proRataValue: 0, regularValue: 0, proRataDays: 0, totalDays: 30 };

    const regularValue = calculateDiscountedPrice.discountedPrice;
    const today = new Date();
    const firstDueDate = calculateFirstDueDate();

    // Billing cycle length = days between last due date and the next due date
    const lastDueDate = new Date(firstDueDate);
    lastDueDate.setMonth(lastDueDate.getMonth() - 1);

    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.max(1, Math.round((firstDueDate.getTime() - lastDueDate.getTime()) / msPerDay));

    // Days to charge in the current cycle = days from today until next due date
    const rawDays = Math.ceil((firstDueDate.getTime() - today.getTime()) / msPerDay);
    const effectiveDays = Math.max(1, Math.min(rawDays, totalDays));

    const proRataValue = Number(((regularValue / totalDays) * effectiveDays).toFixed(2));

    return { proRataValue, regularValue, proRataDays: effectiveDays, totalDays };
  }, [selectedCourse, formData.payment.dueDayOfMonth, calculateDiscountedPrice.discountedPrice]);

  // Calculate total with pro-rata or entry boleto
  const calculateTotalWithProRata = useMemo(() => {
    // For indeterminate contracts (0), use 12 months for carnê generation
    const installmentCount = parseInt(formData.payment.installments) || 12;
    const { proRataValue, regularValue } = calculateProRataValue;
    
    if (!useProRata && !useEntryBoleto) {
      // All installments equal, starting from next month - no entry boleto
      return { 
        proRataValue: regularValue, 
        regularValue, 
        regularInstallments: installmentCount - 1, 
        total: regularValue * installmentCount,
        hasEntryBoleto: false,
        entryBoletoValue: 0,
      };
    }
    
    if (!useProRata && useEntryBoleto) {
      // Entry boleto with full month value
      return { 
        proRataValue: regularValue, 
        regularValue, 
        regularInstallments: installmentCount - 1, 
        total: regularValue * installmentCount,
        hasEntryBoleto: true,
        entryBoletoValue: regularValue,
      };
    }
    
    // Pro-rata calculation (useProRata = true)
    const regularInstallments = installmentCount - 1;
    const total = proRataValue + (regularValue * regularInstallments);
    
    return { 
      proRataValue, 
      regularValue, 
      regularInstallments, 
      total,
      hasEntryBoleto: true,
      entryBoletoValue: proRataValue,
    };
  }, [formData.payment.installments, calculateProRataValue, useProRata, useEntryBoleto]);

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
    if (field === 'cpf') {
      setGuardianSearched(false);
      setFoundGuardianId(null);
    }
  };

  const handleSearchGuardianByCpf = () => {
    const cleanCpf = formData.guardian.cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) {
      toast({
        title: "CPF inválido",
        description: "Digite um CPF válido com 11 dígitos.",
        variant: "destructive",
      });
      return;
    }

    const existingGuardian = getGuardianByCpf(cleanCpf);
    setGuardianSearched(true);
    
    if (existingGuardian) {
      setFoundGuardianId(existingGuardian.id);
      setFormData(prev => ({
        ...prev,
        guardian: {
          name: existingGuardian.name,
          cpf: existingGuardian.cpf,
          email: existingGuardian.email,
          phone: existingGuardian.phone,
          address: existingGuardian.address,
          addressNumber: existingGuardian.address_number || '',
          province: existingGuardian.province || '',
          postalCode: existingGuardian.postal_code || '',
        }
      }));
      toast({
        title: "Responsável encontrado!",
        description: `${existingGuardian.name} já está cadastrado no sistema.`,
      });
    } else {
      setFoundGuardianId(null);
      toast({
        title: "Responsável não encontrado",
        description: "Preencha os dados para cadastrar um novo responsável.",
      });
    }
  };

  const handleClearGuardian = () => {
    setFoundGuardianId(null);
    setGuardianSearched(false);
    setFormData(prev => ({
      ...prev,
      guardian: {
        name: '',
        cpf: '',
        email: '',
        phone: '',
        address: '',
        addressNumber: '',
        province: '',
        postalCode: '',
      }
    }));
  };

  const handlePaymentChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      payment: { ...prev.payment, [field]: value }
    }));
  };

  const handleToggleDay = (dayOfWeek: string) => {
    const timeSlot = TIME_SLOTS.find(ts => ts.id === selectedTimeSlot);
    if (!timeSlot) {
      toast({
        title: "Selecione um horário",
        description: "Primeiro selecione o horário desejado.",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = selectedSchedules.findIndex(
      s => s.dayOfWeek === dayOfWeek && s.timeSlot.id === timeSlot.id
    );

    if (existingIndex >= 0) {
      setSelectedSchedules(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Check if there's a class group available for this schedule
      const classGroup = findClassGroupForSchedule(dayOfWeek, timeSlot.start);
      if (!classGroup) {
        toast({
          title: "Turma indisponível",
          description: `Não há vagas disponíveis para ${dayOfWeek} às ${timeSlot.start}.`,
          variant: "destructive",
        });
        return;
      }
      setSelectedSchedules(prev => [...prev, { dayOfWeek, timeSlot }]);
    }
  };

  const isDaySelected = (dayOfWeek: string) => {
    return selectedSchedules.some(s => s.dayOfWeek === dayOfWeek);
  };

  const validateStudent = () => {
    return formData.student.name.trim() !== '' && formData.student.birthDate !== '';
  };

  // Silent validation for button disabled state (no toasts)
  const isGuardianValid = () => {
    const { name, cpf, email, phone, address, postalCode } = formData.guardian;
    
    // Basic required field check
    if (name.trim() === '' || cpf.trim() === '' || email.trim() === '' || phone.trim() === '' || address.trim() === '' || postalCode.trim() === '') {
      return false;
    }
    
    // Validate CPF
    if (!isValidCPF(cpf)) {
      return false;
    }
    
    // Validate Email
    if (!isValidEmail(email)) {
      return false;
    }
    
    return true;
  };

  // Validation with toast messages for user feedback when clicking next
  const validateGuardianWithFeedback = () => {
    const { name, cpf, email, phone, address, postalCode } = formData.guardian;
    
    // Basic required field check
    if (name.trim() === '' || cpf.trim() === '' || email.trim() === '' || phone.trim() === '' || address.trim() === '' || postalCode.trim() === '') {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios do responsável.',
        variant: 'destructive',
      });
      return false;
    }
    
    // Validate CPF
    if (!isValidCPF(cpf)) {
      toast({
        title: 'CPF inválido',
        description: 'O CPF informado não é válido. Verifique os dígitos e tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
    
    // Validate Email
    if (!isValidEmail(email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Por favor, insira um e-mail válido.',
        variant: 'destructive',
      });
      return false;
    }
    
    return true;
  };

  const validateSchedule = () => {
    // For "Reforço Escolar" course, also require grade level selection
    const isReforcoEscolar = selectedCourse?.name.toLowerCase().includes('reforço escolar');
    if (isReforcoEscolar && !selectedGradeLevel) {
      return false;
    }
    return selectedSchedules.length > 0;
  };

  const handleNextStep = () => {
    // Validate current step with feedback before proceeding
    if (currentStep === 'guardian' && !validateGuardianWithFeedback()) {
      return;
    }
    goToNextStep();
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

  // Get schedule description for display
  const getScheduleDescription = () => {
    if (selectedSchedules.length === 0) return '';
    
    const groupedByTime = selectedSchedules.reduce((acc, s) => {
      const key = `${s.timeSlot.start} às ${s.timeSlot.end}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s.dayOfWeek);
      return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(groupedByTime).map(([time, days]) => 
      `${days.join(', ')} • ${time}`
    ).join(' | ');
  };

  const handleSubmit = async () => {
    if (!selectedCourse || selectedSchedules.length === 0) return;
    
    setIsSubmitting(true);
    
    const finalPrice = calculateDiscountedPrice.discountedPrice;
    const appliedDiscounts = activeDiscounts.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      value: d.value,
    }));

    const existingStudent = existingStudentId ? getStudentById(existingStudentId) : null;
    const existingGuardian = existingStudent ? getGuardianById(existingStudent.guardian_id) : null;
    
    try {
      // 1. Check if Guardian already exists by CPF or use existing one for second course
      const cleanCpf = formData.guardian.cpf.replace(/\D/g, '');
      const normalizedPhone = normalizePhoneToWAPI(formData.guardian.phone);
      let guardian = existingGuardian || getGuardianByCpf(cleanCpf);
      
      if (guardian && !isSecondCourseFlow) {
        await updateGuardian(guardian.id, {
          name: formData.guardian.name,
          email: formData.guardian.email,
          phone: normalizedPhone,
          address: formData.guardian.address,
          address_number: formData.guardian.addressNumber || 'S/N',
          province: formData.guardian.province || 'Centro',
          postal_code: formData.guardian.postalCode.replace(/\D/g, ''),
        });
        guardian = { ...guardian, ...{
          name: formData.guardian.name,
          email: formData.guardian.email,
          phone: normalizedPhone,
          address: formData.guardian.address,
          address_number: formData.guardian.addressNumber || 'S/N',
          province: formData.guardian.province || 'Centro',
          postal_code: formData.guardian.postalCode.replace(/\D/g, ''),
        }};
      } else if (!guardian) {
        guardian = await createGuardian({
          name: formData.guardian.name,
          cpf: cleanCpf,
          email: formData.guardian.email,
          phone: normalizedPhone,
          address: formData.guardian.address,
          address_number: formData.guardian.addressNumber || 'S/N',
          province: formData.guardian.province || 'Centro',
          postal_code: formData.guardian.postalCode.replace(/\D/g, ''),
          asaas_customer_id: null,
        });
      }

      // 2. Create Student in database or use existing one
      let student = existingStudent;
      if (!student) {
        student = await createStudent({
          name: formData.student.name,
          birth_date: formData.student.birthDate,
          guardian_id: guardian.id,
          sex: formData.student.sex,
        });
      }

      // 3. Find the first available class group for selected schedules
      const firstSchedule = selectedSchedules[0];
      const classGroup = findClassGroupForSchedule(firstSchedule.dayOfWeek, firstSchedule.timeSlot.start);
      
      if (!classGroup) {
        throw new Error('Não há vagas disponíveis para o horário selecionado.');
      }

      // 4. Create Enrollment in database
      const enrollment = await createEnrollment({
        student_id: student.id,
        class_group_id: classGroup.id,
        guardian_id: guardian.id,
        status: 'active',
      });

      const scheduleDescription = getScheduleDescription();

      // 5. Call LMS webhook for eligible courses BEFORE generating contract
      let lmsCredentials: { email: string; password: string; matricula: string } | null = null;
      try {
        const lmsResponse = await supabase.functions.invoke('lms-webhook', {
          body: {
            enrollmentId: enrollment.id,
            studentId: student.id,
            guardianId: guardian.id,
            courseId: selectedCourse.id,
            classGroupId: classGroup.id,
          },
        });

        if (lmsResponse.data?.lmsIntegration && lmsResponse.data?.credentials) {
          lmsCredentials = lmsResponse.data.credentials;
          console.log('LMS integration successful:', lmsCredentials);
          toast({
            title: "Acesso LMS criado!",
            description: `Credenciais: ${lmsCredentials.email} / ${lmsCredentials.password}`,
          });
        }
      } catch (lmsError) {
        console.error('LMS webhook error (non-blocking):', lmsError);
        // Non-blocking: don't fail the enrollment if LMS integration fails
      }

      // 5b. Generate Soroban credentials for Soroban courses
      let sorobanCredentials: { email: string; password: string; matricula: string; level: number } | null = null;
      const isSorobanCourse = selectedCourse.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('soroban');
      
      if (isSorobanCourse) {
        try {
          // Generate matricula using enrollment ID
          const sorobanMatricula = `${new Date().getFullYear()}${enrollment.id.slice(-7).toUpperCase()}`;
          
          // Generate email (same pattern as LMS)
          const generateSorobanEmail = (fullName: string): string => {
            const normalized = fullName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();
            const nameParts = normalized.split(' ').filter(part => part.length > 0);
            if (nameParts.length === 0) return `aluno@circuitokids.com.br`;
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            return lastName 
              ? `${firstName}.${lastName}@circuitokids.com.br`
              : `${firstName}@circuitokids.com.br`;
          };
          
          // Generate password (same pattern as LMS)
          const generateSorobanPassword = (name: string, birthDate: string): string => {
            const firstName = name.split(' ')[0].toLowerCase();
            const firstThree = firstName.substring(0, 3);
            const year = birthDate.split('-')[0];
            return `${firstThree}${year}`;
          };
          
          const sorobanEmail = generateSorobanEmail(student.name);
          const sorobanPassword = generateSorobanPassword(student.name, student.birth_date);
          
          // Save credentials to soroban_credentials table
          const { error: sorobanError } = await supabase
            .from('soroban_credentials')
            .upsert({
              student_id: student.id,
              enrollment_id: enrollment.id,
              email: sorobanEmail,
              password: sorobanPassword,
              matricula: sorobanMatricula,
              current_level: 1,
            }, {
              onConflict: 'matricula',
            });
          
          if (sorobanError) {
            console.error('Error saving Soroban credentials:', sorobanError);
          } else {
            sorobanCredentials = {
              email: sorobanEmail,
              password: sorobanPassword,
              matricula: sorobanMatricula,
              level: 1,
            };
            console.log('Soroban credentials saved:', sorobanCredentials);
            toast({
              title: "Acesso Soroban criado!",
              description: `Credenciais: ${sorobanEmail} / ${sorobanPassword}`,
            });
          }
        } catch (sorobanError) {
          console.error('Soroban credentials error (non-blocking):', sorobanError);
          // Non-blocking: don't fail the enrollment if Soroban integration fails
        }
      }

      // 6. Generate Contract (with LMS and/or Soroban credentials if available)
      const gradeLevelInfo = GRADE_LEVELS.find(g => g.id === selectedGradeLevel);
      const contractContent = {
        schoolName: contractConfig?.school_name || 'EduGestor',
        schoolCnpj: contractConfig?.school_cnpj || '',
        schoolAddress: contractConfig?.school_address || '',
        schoolLogo: branding?.logo || '',
        guardianName: guardian.name,
        guardianCpf: guardian.cpf,
        guardianAddress: guardian.address,
        studentName: student.name,
        studentBirthDate: student.birth_date,
        studentSex: formData.student.sex,
        studentAge: calculateAge(student.birth_date),
        courseName: selectedCourse.name,
        courseDuration: selectedCourse.duration,
        coursePrice: finalPrice,
        originalPrice: selectedCourse.price,
        classGroupName: classGroup.name,
        schedule: scheduleDescription,
        selectedDays: selectedSchedules.map(s => ({
          day: s.dayOfWeek,
          time: `${s.timeSlot.start} às ${s.timeSlot.end}`
        })),
        gradeLevel: selectedCourse.name.toLowerCase().includes('reforço escolar') && gradeLevelInfo ? {
          id: gradeLevelInfo.id,
          label: gradeLevelInfo.label,
          description: gradeLevelInfo.description,
        } : null,
        contractDuration: parseInt(formData.payment.installments), // Duração do contrato em meses
        contractDurationLabel: `${formData.payment.installments} meses`,
        installments: parseInt(formData.payment.installments),
        installmentValue: finalPrice,
        totalValue: finalPrice * parseInt(formData.payment.installments),
        discounts: appliedDiscounts,
        totalDiscount: calculateDiscountedPrice.totalDiscount * parseInt(formData.payment.installments),
        clauses: contractClauses.filter(c => c.is_active).map(c => ({
          title: c.title,
          content: c.content,
        })),
        createdAt: new Date().toISOString(),
        lmsCredentials: lmsCredentials,
        sorobanCredentials: sorobanCredentials,
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

      // 6. Check if this is a 100% discount - skip all payment generation
      const isFullDiscount = calculateDiscountedPrice.isFullDiscount;
      
      let asaasCustomer: { id: string } | null = null;
      let carneData = null;
      let proRataBoletoData: { id: string; invoiceUrl: string | null; bankSlipUrl: string | null } | null = null;
      
      if (isFullDiscount) {
        // 100% discount - only generate contract, no boletos or carnês
        console.log('Desconto de 100% aplicado - pulando geração de boletos e carnês');
        
        toast({
          title: "Desconto de 100% aplicado",
          description: "Matrícula isenta de pagamento. Apenas o contrato foi gerado.",
        });
      } else {
        // Normal flow - create customer and payments in Asaas
        
        // Create Customer in Asaas (or use existing)
        if (guardian.asaas_customer_id) {
          asaasCustomer = { id: guardian.asaas_customer_id };
        } else {
          asaasCustomer = await createCustomer({
            name: guardian.name,
            cpfCnpj: guardian.cpf,
            email: guardian.email,
            phone: guardian.phone,
            address: guardian.address,
            addressNumber: formData.guardian.addressNumber || guardian.address_number || 'S/N',
            province: formData.guardian.province || guardian.province || 'Centro',
            postalCode: guardian.postal_code,
          });

          // Save the asaas_customer_id back to the guardian record
          if (asaasCustomer?.id) {
            const { error: updateGuardianError } = await supabase
              .from('guardians')
              .update({ asaas_customer_id: asaasCustomer.id })
              .eq('id', guardian.id);
            
            if (updateGuardianError) {
              console.error('Erro ao salvar asaas_customer_id no responsável:', updateGuardianError);
            } else {
              console.log('asaas_customer_id salvo com sucesso:', asaasCustomer.id);
            }
          }
        }

        if (!asaasCustomer) {
          throw new Error('Erro ao criar cliente no sistema de pagamentos');
        }

        // 7. Generate payment in Asaas
        const installmentCount = parseInt(formData.payment.installments);
        const discountInfo = appliedDiscounts.length > 0 
          ? ` (${appliedDiscounts.map(d => d.name).join(', ')})` 
          : '';
        const description = `Mensalidade - ${selectedCourse.name} - Aluno: ${student.name}${discountInfo}`;
        
        // Calculate dates
        const proRataDueDate = calculateProRataDueDate();
        const proRataDueDateStr = proRataDueDate.toISOString().split('T')[0];
        const firstDueDate = calculateFirstDueDate();
        const firstDueDateStr = firstDueDate.toISOString().split('T')[0];
        
        // Calculate pro-rata value
        const proRataValue = calculateTotalWithProRata.proRataValue;
        const regularValue = calculateTotalWithProRata.regularValue;
        
        const discountConfig = {
          value: 5, // 5% de desconto por antecipação
          dueDateLimitDays: 5, // até 5 dias antes do vencimento
          type: 'PERCENTAGE' as const,
        };
        
        // Always generate entry boleto (pro-rata or full value) when:
        // 1. Pro-rata is enabled and there are multiple installments (always generates entry boleto with pro-rata value)
        // 2. Entry boleto is enabled (without pro-rata) and there are multiple installments
        const needsEntryBoleto = (useProRata && installmentCount > 1) || 
                                 (!useProRata && useEntryBoleto && installmentCount > 1);
      
      if (needsEntryBoleto) {
        // Calculate entry boleto value
        const entryBoletoValue = useProRata ? proRataValue : regularValue;
        const entryBoletoDescription = useProRata 
          ? `${description} - Pro-Rata (1ª Parcela)` 
          : `${description} - Entrada (1ª Parcela)`;
        
        // Create entry boleto (due in 5 days from enrollment)
        const entryBoleto = await createAsaasBoleto({
          customerId: asaasCustomer.id,
          value: entryBoletoValue,
          dueDate: proRataDueDateStr,
          description: entryBoletoDescription,
          externalReference: enrollment.id,
          discount: discountConfig,
        });
        
        if (entryBoleto) {
          proRataBoletoData = {
            id: entryBoleto.id,
            invoiceUrl: entryBoleto.invoiceUrl || null,
            bankSlipUrl: entryBoleto.bankSlipUrl || null,
          };
          
          // Save entry payment to database
          await createPayment({
            enrollment_id: enrollment.id,
            guardian_id: guardian.id,
            contract_id: contract.id,
            asaas_payment_id: entryBoleto.id,
            asaas_installment_id: null,
            description: useProRata ? `${description} - Pro-Rata` : `${description} - Entrada`,
            value: entryBoleto.value,
            due_date: entryBoleto.dueDate,
            status: entryBoleto.status,
            invoice_url: entryBoleto.invoiceUrl,
            bank_slip_url: entryBoleto.bankSlipUrl,
            installment_number: 1,
            external_reference: enrollment.id,
          });
        }
      }
      
      // Generate carnê only if user chose to do so
      if (generateCarneNow) {
        if (needsEntryBoleto) {
          // Create carnê for remaining installments - starts on firstDueDate (next month)
          const remainingInstallments = installmentCount - 1;
          const totalRemainingValue = regularValue * remainingInstallments;
          
          const asaasPayment = await createAsaasCarne({
            customerId: asaasCustomer.id,
            value: totalRemainingValue,
            dueDate: firstDueDateStr,
            description: `${description} - Parcelas 2 a ${installmentCount}`,
            installmentCount: remainingInstallments,
            externalReference: enrollment.id,
            discount: discountConfig,
          });
          
          if (asaasPayment) {
            const entryBoletoValue = useProRata ? proRataValue : regularValue;
            const savedCarne = await createCarne({
              enrollment_id: enrollment.id,
              guardian_id: guardian.id,
              contract_id: contract.id,
              asaas_installment_id: asaasPayment.installment || asaasPayment.id,
              description,
              total_value: entryBoletoValue + totalRemainingValue,
              installment_count: installmentCount,
              first_due_date: proRataDueDateStr,
            });

            carneData = {
              id: savedCarne.id,
              asaasInstallmentId: asaasPayment.installment || asaasPayment.id,
            };
          }
        } else {
          // Standard flow: all installments equal, no entry boleto
          const totalValue = regularValue * installmentCount;
          
          const asaasPayment = await createAsaasCarne({
            customerId: asaasCustomer.id,
            value: totalValue,
            dueDate: firstDueDateStr,
            description,
            installmentCount,
            externalReference: enrollment.id,
            discount: discountConfig,
          });

          if (asaasPayment) {
            const savedCarne = await createCarne({
              enrollment_id: enrollment.id,
              guardian_id: guardian.id,
              contract_id: contract.id,
              asaas_installment_id: asaasPayment.installment || asaasPayment.id,
              description,
              total_value: totalValue,
              installment_count: installmentCount,
              first_due_date: firstDueDateStr,
            });

            carneData = {
              id: savedCarne.id,
              asaasInstallmentId: asaasPayment.installment || asaasPayment.id,
            };

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
        }
      } else if (!needsEntryBoleto) {
        // When not generating carnê now and no entry boleto, create a pending payment record
        const firstDueDateStr = calculateFirstDueDate().toISOString().split('T')[0];
        
        await createPayment({
          enrollment_id: enrollment.id,
          guardian_id: guardian.id,
          contract_id: contract.id,
          asaas_payment_id: null,
          asaas_installment_id: null,
          description: `${description} - Aguardando geração de carnê`,
          value: calculateTotalWithProRata.regularValue,
          due_date: firstDueDateStr,
          status: 'PENDING',
          invoice_url: null,
          bank_slip_url: null,
          installment_number: 1,
          external_reference: enrollment.id,
        });
        }
      } // End of else block for non-100% discount

      // 8. Update enrollment with contract flag
      await updateEnrollment(enrollment.id, { contract_generated: true });

      setEnrollmentResult({
        contract: {
          id: contract.id,
          content: contractContent,
        },
        carne: carneData,
        proRataBoleto: proRataBoletoData,
      });

      // Build toast message based on what was generated
      let toastDescription = "O contrato foi gerado.";
      
      if (isFullDiscount) {
        // 100% discount - only contract was generated
        toastDescription = "Matrícula isenta. Apenas o contrato foi gerado (desconto de 100%).";
      } else {
        const installmentCount = parseInt(formData.payment.installments);
        const hasEntryBoleto = (useProRata && installmentCount > 1) || 
                               (!useProRata && useEntryBoleto && installmentCount > 1);
        
        if (hasEntryBoleto) {
          if (generateCarneNow) {
            toastDescription = useProRata 
              ? "O contrato, boleto pro-rata e carnê foram gerados automaticamente."
              : "O contrato, boleto de entrada e carnê foram gerados automaticamente.";
          } else {
            toastDescription = useProRata 
              ? "O contrato e boleto pro-rata foram gerados. O carnê poderá ser gerado na página de Contratos."
              : "O contrato e boleto de entrada foram gerados. O carnê poderá ser gerado na página de Contratos.";
          }
        } else {
          if (generateCarneNow) {
            toastDescription = "O contrato e o carnê foram gerados automaticamente.";
          } else {
            toastDescription = "O contrato foi gerado. O carnê poderá ser gerado posteriormente na página de Contratos.";
          }
        }
      }

      toast({
        title: "Matrícula realizada com sucesso!",
        description: toastDescription,
      });

      // 9. Send enrollment welcome message (non-blocking)
      try {
        const welcomeResponse = await supabase.functions.invoke('send-enrollment-welcome', {
          body: {
            guardianId: guardian.id,
            guardianName: guardian.name,
            guardianPhone: guardian.phone,
            studentName: student.name,
            courseName: selectedCourse.name,
          },
        });
        
        if (welcomeResponse.data?.sent) {
          console.log('Enrollment welcome message sent successfully');
        } else if (welcomeResponse.data?.skipped) {
          console.log('Enrollment welcome skipped:', welcomeResponse.data.reason);
        } else if (welcomeResponse.error) {
          console.warn('Enrollment welcome error:', welcomeResponse.error);
        }
      } catch (welcomeError) {
        console.warn('Failed to send enrollment welcome (non-blocking):', welcomeError);
      }

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
        
        // Aguarda todas as imagens carregarem antes de imprimir
        const images = printWindow.document.images;
        if (images.length > 0) {
          let loadedCount = 0;
          const checkAllLoaded = () => {
            loadedCount++;
            if (loadedCount >= images.length) {
              setTimeout(() => printWindow.print(), 100);
            }
          };
          
          Array.from(images).forEach((img) => {
            if (img.complete) {
              checkAllLoaded();
            } else {
              img.onload = checkAllLoaded;
              img.onerror = checkAllLoaded;
            }
          });
        } else {
          printWindow.print();
        }
      }
    } else {
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
      if (booklet?.pdfBase64) {
        const byteCharacters = atob(booklet.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
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
      if (booklet?.pdfBase64) {
        const byteCharacters = atob(booklet.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `carne_${enrollmentResult.carne.asaasInstallmentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
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

  const handleViewProRataBoleto = () => {
    if (!enrollmentResult?.proRataBoleto) {
      toast({
        title: "Erro",
        description: "Boleto de entrada não encontrado",
        variant: "destructive",
      });
      return;
    }

    const url = enrollmentResult.proRataBoleto.invoiceUrl || enrollmentResult.proRataBoleto.bankSlipUrl;
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({
        title: "Erro",
        description: "URL do boleto não disponível",
        variant: "destructive",
      });
    }
  };

  const handleDownloadProRataBoleto = () => {
    if (!enrollmentResult?.proRataBoleto) {
      toast({
        title: "Erro",
        description: "Boleto de entrada não encontrado",
        variant: "destructive",
      });
      return;
    }

    const url = enrollmentResult.proRataBoleto.bankSlipUrl || enrollmentResult.proRataBoleto.invoiceUrl;
    if (url) {
      // For PDFs, we can try to download directly
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `boleto_entrada_${enrollmentResult.proRataBoleto.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: "Erro",
        description: "URL do boleto não disponível",
        variant: "destructive",
      });
    }
  };

  const handleNewEnrollment = () => {
    setFormData({
      student: { name: '', birthDate: '', sex: 'M' },
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
        dueDayOfMonth: '10',
      }
    });
    setSelectedSchedules([]);
    setSelectedTimeSlot('');
    setSelectedGradeLevel('');
    setEnrollmentResult(null);
    setCurrentStep('student');
  };

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
                {studentAge !== null && (
                  <p className="text-sm text-muted-foreground">
                    Idade: <span className="font-medium text-foreground">{studentAge} anos</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentSex">Sexo</Label>
                <Select 
                  value={formData.student.sex} 
                  onValueChange={(value: 'M' | 'F') => handleStudentChange('sex', value)}
                >
                  <SelectTrigger id="studentSex">
                    <SelectValue placeholder="Selecione o sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
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
            
            {/* CPF Search Section */}
            <div className="bg-secondary/30 rounded-lg p-4 mb-6 border border-border/50">
              <Label className="text-sm font-medium mb-2 block">Buscar responsável existente</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o CPF para buscar..."
                  value={formData.guardian.cpf}
                  onChange={(e) => handleGuardianChange('cpf', e.target.value)}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleSearchGuardianByCpf}
                  className="shrink-0"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>
              {guardianSearched && (
                <p className={cn(
                  "text-sm mt-2",
                  foundGuardianId ? "text-success" : "text-muted-foreground"
                )}>
                  {foundGuardianId 
                    ? "✓ Responsável encontrado! Os dados foram preenchidos automaticamente." 
                    : "Nenhum responsável encontrado com este CPF. Preencha os dados abaixo."
                  }
                </p>
              )}
            </div>

            {/* Found Guardian Card */}
            {foundGuardianId && (
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{formData.guardian.name}</p>
                      <p className="text-sm text-muted-foreground">CPF: {formData.guardian.cpf}</p>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={handleClearGuardian}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="guardianName">Nome Completo</Label>
                <Input
                  id="guardianName"
                  placeholder="Nome do responsável"
                  value={formData.guardian.name}
                  onChange={(e) => handleGuardianChange('name', e.target.value)}
                  disabled={!!foundGuardianId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formData.guardian.cpf}
                  onChange={(e) => handleGuardianChange('cpf', formatCPF(e.target.value))}
                  disabled={!!foundGuardianId}
                  className={formData.guardian.cpf && !isValidCPF(formData.guardian.cpf) ? 'border-destructive' : ''}
                />
                {formData.guardian.cpf && !isValidCPF(formData.guardian.cpf) && (
                  <p className="text-xs text-destructive">CPF inválido</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.guardian.email}
                  onChange={(e) => handleGuardianChange('email', e.target.value)}
                  className={formData.guardian.email && !isValidEmail(formData.guardian.email) ? 'border-destructive' : ''}
                />
                {formData.guardian.email && !isValidEmail(formData.guardian.email) && (
                  <p className="text-xs text-destructive">E-mail inválido</p>
                )}
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
              {courses.filter(c => c.is_active).map((course) => {
                const isCourseReforcoEscolar = course.name.toLowerCase().includes('reforço escolar');
                
                return (
                  <button
                    key={course.id}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, courseId: course.id, classGroupId: '' }));
                      setSelectedSchedules([]);
                      setSelectedTimeSlot('');
                    }}
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
                      {isCourseReforcoEscolar ? (
                        <div className="text-right">
                          <span className="text-sm text-primary font-medium">
                            A partir de R$ 200,00
                          </span>
                          <p className="text-xs text-muted-foreground">
                            2x R$200 | 3x R$300 | 5x R$350
                          </p>
                        </div>
                      ) : (
                        <span className="text-lg font-semibold text-primary">
                          R$ {Number(course.price).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 'schedule' && (
          <div>
            <h2 className="form-section-title">Selecione os Dias e Horário</h2>
            {selectedCourse && (
              <p className="text-sm text-muted-foreground mb-6">
                Escolha os dias da semana para <strong>{selectedCourse.name}</strong>. Você pode selecionar quantos dias quiser.
              </p>
            )}

            {/* Grade Level Selection for Reforço Escolar */}
            {selectedCourse?.name.toLowerCase().includes('reforço escolar') && (
              <div className="mb-6">
                <Label className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4" />
                  Série/Turma do Aluno
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione a série do aluno para alocação na sala correta:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map((grade) => (
                    <button
                      key={grade.id}
                      onClick={() => setSelectedGradeLevel(grade.id)}
                      className={cn(
                        'p-4 rounded-xl border-2 text-center transition-all duration-200',
                        selectedGradeLevel === grade.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <p className="font-semibold">{grade.label}</p>
                      <p className={cn(
                        "text-xs mt-1",
                        selectedGradeLevel === grade.id ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {grade.description}
                      </p>
                      {selectedGradeLevel === grade.id && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-success-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time Slot Selection */}
            <div className="mb-6">
              <Label className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Horário
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => {
                      setSelectedTimeSlot(slot.id);
                      // Clear schedules when changing time slot
                      setSelectedSchedules([]);
                    }}
                    className={cn(
                      'p-4 rounded-xl border-2 text-center transition-all duration-200',
                      selectedTimeSlot === slot.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <p className="text-xs text-muted-foreground mb-1">{slot.period}</p>
                    <p className="font-semibold text-foreground">{slot.start}</p>
                    <p className="text-sm text-muted-foreground">às {slot.end}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Day Selection */}
            {selectedTimeSlot && (
              <div className="mb-6">
                <Label className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4" />
                  Dias da Semana
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Clique nos dias que o aluno frequentará as aulas:
                </p>
                <div className="grid grid-cols-5 gap-3">
                  {WEEKDAYS.map((day) => {
                    const timeSlot = TIME_SLOTS.find(ts => ts.id === selectedTimeSlot);
                    const classGroup = timeSlot ? findClassGroupForSchedule(day, timeSlot.start) : null;
                    const hasVacancy = !!classGroup;
                    const isSelected = isDaySelected(day);
                    const vacancies = classGroup ? classGroup.max_students - classGroup.current_students : 0;

                    return (
                      <button
                        key={day}
                        onClick={() => handleToggleDay(day)}
                        disabled={!hasVacancy && !isSelected}
                        className={cn(
                          'p-4 rounded-xl border-2 text-center transition-all duration-200 relative',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : hasVacancy
                            ? 'border-border hover:border-primary/50'
                            : 'border-border/50 bg-muted/50 cursor-not-allowed opacity-50'
                        )}
                      >
                        <p className="font-semibold text-sm">
                          {day.replace('-feira', '')}
                        </p>
                        {hasVacancy && (
                          <p className={cn(
                            "text-xs mt-1",
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {vacancies} vagas
                          </p>
                        )}
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-success-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected Schedule Summary */}
            {selectedSchedules.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <h4 className="font-medium text-foreground mb-2">Dias Selecionados</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSchedules.map((s, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {s.dayOfWeek.replace('-feira', '')} • {s.timeSlot.start} às {s.timeSlot.end}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Total: {selectedSchedules.length} {selectedSchedules.length === 1 ? 'dia' : 'dias'} por semana
                </p>
                {isReforcoEscolar && selectedSchedules.length > 0 && (
                  <p className="text-sm font-medium text-primary mt-1">
                    Valor: R$ {effectiveCoursePrice.toFixed(2).replace('.', ',')} /mês
                  </p>
                )}
                {selectedGradeLevel && isReforcoEscolar && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Turma: {GRADE_LEVELS.find(g => g.id === selectedGradeLevel)?.label}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 'payment' && (
          <div>
            <h2 className="form-section-title">Configuração do Carnê</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure o parcelamento, descontos e a data de vencimento das mensalidades.
            </p>
            
            {selectedCourse && (
              <div className="bg-secondary/30 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Curso selecionado</span>
                  <span className="font-semibold">{selectedCourse.name}</span>
                </div>
                {isReforcoEscolar && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Dias por semana</span>
                    <span className="font-semibold">{selectedSchedules.length}x por semana</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Valor padrão do curso</span>
                  <span className={cn(
                    "font-semibold",
                    (customPrice || selectedDiscountIds.length > 0) ? "line-through text-muted-foreground" : "text-primary"
                  )}>
                    R$ {(isReforcoEscolar && selectedSchedules.length > 0 
                      ? REFORCO_ESCOLAR_PRICES[selectedSchedules.length] || REFORCO_ESCOLAR_PRICES[5]
                      : Number(selectedCourse.price)
                    ).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {/* Custom Price Field */}
                <div className="border-t border-border/50 pt-4 mt-4">
                  <Label htmlFor="customPrice" className="text-sm font-medium mb-2 block">
                    Valor Personalizado (opcional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      id="customPrice"
                      type="text"
                      placeholder="Ex: 150,00"
                      value={customPrice}
                      onChange={(e) => {
                        // Allow only numbers, comma, and dot
                        const value = e.target.value.replace(/[^0-9,.-]/g, '');
                        setCustomPrice(value);
                      }}
                      className="max-w-[150px]"
                    />
                    {customPrice && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomPrice('')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para usar o valor padrão do curso
                  </p>
                </div>
                
                {/* Effective price display */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Valor base da mensalidade</span>
                  <span className={cn(
                    "font-semibold",
                    selectedDiscountIds.length > 0 ? "line-through text-muted-foreground" : "text-primary"
                  )}>
                    R$ {effectiveCoursePrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {selectedDiscountIds.length > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">Valor com desconto</span>
                    <span className="font-semibold text-success">
                      R$ {calculateDiscountedPrice.discountedPrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Discount Selection */}
            {discounts.filter(d => d.is_active).length > 0 && (
              <div className="mb-6">
                <Label className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4" />
                  Aplicar Descontos
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {discounts.filter(d => d.is_active).map((discount) => (
                    <label
                      key={discount.id}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                        selectedDiscountIds.includes(discount.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Checkbox
                        checked={selectedDiscountIds.includes(discount.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDiscountIds(prev => [...prev, discount.id]);
                          } else {
                            setSelectedDiscountIds(prev => prev.filter(id => id !== discount.id));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{discount.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {discount.type === 'percentage' 
                              ? `${discount.value}%` 
                              : `R$ ${discount.value.toFixed(2).replace('.', ',')}`
                            }
                          </Badge>
                        </div>
                        {discount.description && (
                          <p className="text-sm text-muted-foreground mt-1">{discount.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {/* Contract Duration Selection */}
            <div className="space-y-2 mb-6">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Duração do Contrato
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => handlePaymentChange('installments', '6')}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    formData.payment.installments === '6'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl font-bold text-primary">6</span>
                  <p className="text-sm text-muted-foreground">meses</p>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentChange('installments', '12')}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    formData.payment.installments === '12'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl font-bold text-primary">12</span>
                  <p className="text-sm text-muted-foreground">meses</p>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentChange('installments', '18')}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    formData.payment.installments === '18'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl font-bold text-primary">18</span>
                  <p className="text-sm text-muted-foreground">meses</p>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentChange('installments', '0')}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    formData.payment.installments === '0'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-lg font-bold text-primary">∞</span>
                  <p className="text-sm text-muted-foreground">Indeterminado</p>
                </button>
              </div>
              {formData.payment.installments === '0' && (
                <p className="text-sm text-muted-foreground bg-amber-500/10 text-amber-600 p-3 rounded-lg">
                  Contrato por tempo indeterminado. O carnê será gerado com 12 parcelas iniciais.
                </p>
              )}
            </div>

            {/* Pro-Rata Toggle - Hidden when 100% discount */}
            {!calculateDiscountedPrice.isFullDiscount && (
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl mb-4">
                <div>
                  <Label className="font-medium">Cálculo Pro-Rata</Label>
                  <p className="text-sm text-muted-foreground">
                    A primeira parcela é calculada proporcionalmente aos dias até o vencimento
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProRata}
                    onChange={(e) => {
                      setUseProRata(e.target.checked);
                      // Se ativar pro-rata, desativa boleto de entrada (são mutuamente exclusivos para o cálculo)
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/20 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            )}

            {/* Entry Boleto Toggle - only show if pro-rata is disabled, has installments, and NOT 100% discount */}
            {!calculateDiscountedPrice.isFullDiscount && !useProRata && (parseInt(formData.payment.installments) > 1 || formData.payment.installments === '0') && (
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-xl mb-6 border border-primary/20">
                <div>
                  <Label className="font-medium">Boleto de Entrada</Label>
                  <p className="text-sm text-muted-foreground">
                    Gera boleto avulso com valor cheio da mensalidade para pagamento imediato
                  </p>
                  <p className="text-xs text-primary mt-1">
                    Vencimento: {calculateProRataDueDate().toLocaleDateString('pt-BR')} (5 dias após matrícula)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useEntryBoleto}
                    onChange={(e) => setUseEntryBoleto(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/20 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            )}

            {/* Full Discount Alert */}
            {calculateDiscountedPrice.isFullDiscount && (
              <div className="p-4 bg-success/10 border-2 border-success/30 rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/20 rounded-full">
                    <Percent className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-success">Matrícula Isenta (100% de Desconto)</p>
                    <p className="text-sm text-muted-foreground">
                      Nenhum boleto ou carnê será gerado. Apenas o contrato do aluno será criado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Carnê Toggle - Hidden when 100% discount */}
            {!calculateDiscountedPrice.isFullDiscount && (
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl mb-4 border-2 border-primary/30">
                <div>
                  <Label className="font-medium flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Gerar Carnê Agora
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {generateCarneNow 
                      ? "O carnê será gerado automaticamente ao finalizar a matrícula"
                      : "Você poderá gerar o carnê posteriormente na página de Contratos"}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateCarneNow}
                    onChange={(e) => setGenerateCarneNow(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/20 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <Label>Dia de Vencimento</Label>
              <Select
                value={formData.payment.dueDayOfMonth}
                onValueChange={(value) => handlePaymentChange('dueDayOfMonth', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dueDateOptions.map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                1º vencimento do carnê: {calculateFirstDueDate().toLocaleDateString('pt-BR')}
              </p>
            </div>

            {selectedCourse && (
              <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                {calculateDiscountedPrice.totalDiscount > 0 && (
                  <div className="flex justify-between items-center mb-2 text-success">
                    <span className="text-sm flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Desconto aplicado
                    </span>
                    <span className="font-medium">
                      - R$ {(calculateDiscountedPrice.totalDiscount * parseInt(formData.payment.installments)).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
                
                <div className="space-y-2 mb-3">
                  {/* Show entry boleto info */}
                  {calculateTotalWithProRata.hasEntryBoleto && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        {useProRata 
                          ? `1ª Parcela (pro-rata - ${calculateProRataValue.proRataDays} dias):` 
                          : `Boleto de Entrada (valor cheio):`}
                      </span>
                      <span className="font-medium text-primary">
                        R$ {calculateTotalWithProRata.entryBoletoValue.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {calculateTotalWithProRata.hasEntryBoleto 
                        ? `Demais Parcelas (${calculateTotalWithProRata.regularInstallments}x):` 
                        : `Parcelas (${parseInt(formData.payment.installments)}x):`}
                    </span>
                    <span className="font-medium">R$ {calculateTotalWithProRata.regularValue.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                  <span className="font-medium">Valor Total</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {calculateTotalWithProRata.total.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {activeDiscounts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      Descontos aplicados: {activeDiscounts.map(d => d.name).join(', ')}
                    </p>
                  </div>
                )}
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
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Dias e Horários</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedSchedules.map((s, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {s.dayOfWeek.replace('-feira', '')} {s.timeSlot.start}
                      </Badge>
                    ))}
                  </div>
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
              <div className={cn(
                "rounded-xl p-4 flex items-start gap-3",
                generateCarneNow ? "bg-primary/10" : "bg-warning/10"
              )}>
                <CreditCard className={cn("w-5 h-5 mt-0.5", generateCarneNow ? "text-primary" : "text-warning")} />
                <div>
                  <p className="font-medium text-foreground">Carnê de pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    {generateCarneNow 
                      ? `Serão gerados ${formData.payment.installments} boletos para pagamento.`
                      : "O carnê será gerado posteriormente na página de Contratos."}
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
                price: Number(selectedCourse.price),
              } : { name: '', duration: '', price: 0 },
              schedule: getScheduleDescription(),
              gradeLevel: selectedCourse?.name.toLowerCase().includes('reforço escolar') && selectedGradeLevel
                ? GRADE_LEVELS.find(g => g.id === selectedGradeLevel) || null
                : null,
              payment: {
                installments: parseInt(formData.payment.installments),
                dueDayOfMonth: parseInt(formData.payment.dueDayOfMonth),
                firstDueDate: calculateFirstDueDate().toISOString().split('T')[0],
                entryBoletoDueDate: enrollmentResult.proRataBoleto ? calculateProRataDueDate().toISOString().split('T')[0] : undefined,
                proRataValue: calculateTotalWithProRata.proRataValue,
                regularValue: calculateTotalWithProRata.regularValue,
                total: calculateTotalWithProRata.total,
              },
              contract: enrollmentResult.contract,
              carne: enrollmentResult.carne,
              proRataBoleto: enrollmentResult.proRataBoleto,
            }}
            onPrintContract={handlePrintContract}
            onViewCarne={handleViewCarne}
            onDownloadCarne={handleDownloadCarne}
            onViewProRataBoleto={handleViewProRataBoleto}
            onDownloadProRataBoleto={handleDownloadProRataBoleto}
            onNewEnrollment={handleNewEnrollment}
            isLoadingCarne={isLoadingCarne}
          />
        )}

        {/* Navigation Buttons */}
        {currentStep !== 'summary' && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStepIndex === 0 || (isSecondCourseFlow && currentStep === 'course')}
            >
              Voltar
            </Button>
            {currentStep === 'contract' ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isAsaasLoading}
                className="min-w-[200px]"
              >
                {isSubmitting || isAsaasLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Finalizar Matrícula
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNextStep}
                disabled={
                  (currentStep === 'student' && !validateStudent()) ||
                  (currentStep === 'guardian' && !isGuardianValid()) ||
                  (currentStep === 'course' && !formData.courseId) ||
                  (currentStep === 'schedule' && !validateSchedule())
                }
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Contract Modal */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato de Matrícula</DialogTitle>
          </DialogHeader>
          {enrollmentResult?.contract && (
            <ContractPrintView
              ref={contractPrintRef}
              content={enrollmentResult.contract.content}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
