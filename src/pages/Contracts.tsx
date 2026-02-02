import { useState, useRef, useEffect } from 'react';
import { FileText, Download, Calendar, User, Settings, Eye, Loader2, CreditCard, Printer, PenLine, CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { generateContractPDF } from '@/utils/pdfGenerator';
import { preloadContractImages } from '@/utils/imageLoader';
import { useToast } from '@/hooks/use-toast';
import { ContractPrintView } from '@/components/enrollment/ContractPrintView';
import { SignatureModal } from '@/components/contracts/SignatureModal';
import { SignedContractModal } from '@/components/contracts/SignedContractModal';
import { supabase } from '@/integrations/supabase/client';

export default function Contracts() {
  const { toast } = useToast();
  const { 
    enrollments, 
    contracts, 
    contractClauses, 
    carnes,
    getStudentById, 
    getGuardianById, 
    getClassGroupById, 
    getCourseById, 
    getScheduleById, 
    contractConfig,
    createCarne,
    createPayment,
    refetchCarnes
  } = useSchool();
  const { branding } = useSystemBranding();
  const { createCustomer, createCarne: createAsaasCarne, createBoleto: createAsaasBoleto, isLoading: isAsaasLoading } = useAsaasPayment();
  const { sendMessage, isSending: isSendingWhatsApp } = useWapiMessage();
  
  // Template for contract signature WhatsApp message
  const [signatureTemplate, setSignatureTemplate] = useState<string>('');
  
  useEffect(() => {
    const fetchTemplate = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'whatsapp_template_contract_signature')
        .single();
      
      if (data?.value) {
        setSignatureTemplate(data.value);
      }
    };
    fetchTemplate();
  }, []);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewContract, setPreviewContract] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const contractPrintRef = useRef<HTMLDivElement>(null);
  
  // State for generating carnê later
  const [showCarneModal, setShowCarneModal] = useState(false);
  const [selectedContractForCarne, setSelectedContractForCarne] = useState<any | null>(null);
  const [carneInstallments, setCarneInstallments] = useState('6');
  const [carneDueDay, setCarneDueDay] = useState('10');
  const [isGeneratingCarne, setIsGeneratingCarne] = useState(false);
  
  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedContractForSignature, setSelectedContractForSignature] = useState<{
    id: string;
    studentName: string;
    courseName: string;
    guardianName: string;
    totalValue: number;
    installments: number;
  } | null>(null);

  // Signed contract modal state
  const [showSignedContractModal, setShowSignedContractModal] = useState(false);
  const [selectedSignedContract, setSelectedSignedContract] = useState<{
    id: string;
    studentName: string;
    guardianName: string;
    courseName: string;
    totalValue: number;
    installments: number;
    signedAt: string;
    signatureHash: string | null;
    signatureImage: string | null;
    signedIp: string | null;
    signedUserAgent: string | null;
  } | null>(null);
  interface ContractContentType {
    schoolName: string;
    schoolCnpj: string;
    schoolAddress: string;
    guardianName: string;
    guardianCpf: string;
    guardianAddress: string;
    studentName: string;
    studentBirthDate: string;
    courseName: string;
    courseDuration: string;
    coursePrice: number;
    classGroupName: string;
    schedule: string;
    installments: number;
    installmentValue: number;
    totalValue: number;
    clauses: { title: string; content: string }[];
    createdAt: string;
  }

  const contractEnrollments = enrollments.filter(e => e.contract_generated);

  // Check if enrollment has a carnê
  const enrollmentHasCarne = (enrollmentId: string) => {
    return carnes.some(c => c.enrollment_id === enrollmentId);
  };

  // Get contract for enrollment
  const getContractForEnrollment = (enrollmentId: string) => {
    return contracts.find(c => c.enrollment_id === enrollmentId);
  };

  // Check if contract is signed
  const isContractSigned = (enrollmentId: string) => {
    const contract = getContractForEnrollment(enrollmentId);
    return contract?.signed_at !== null;
  };

  // Get signature link for contract
  const getSignatureLink = (enrollmentId: string) => {
    const contract = getContractForEnrollment(enrollmentId);
    if (!contract) return '';
    const token = (contract as any).signature_token;
    return token ? `${window.location.origin}/assinar/${token}` : '';
  };

  // Copy signature link to clipboard
  const copySignatureLink = async (enrollmentId: string) => {
    const link = getSignatureLink(enrollmentId);
    if (!link) return;
    
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link copiado!',
        description: 'O link de assinatura foi copiado para a área de transferência.',
      });
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  };

  // Send signature link via WhatsApp
  const handleSendSignatureLinkWhatsApp = async (enrollment: typeof enrollments[0]) => {
    const link = getSignatureLink(enrollment.id);
    if (!link) {
      toast({
        title: 'Erro',
        description: 'Link de assinatura não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    const student = getStudentById(enrollment.student_id);
    const guardian = getGuardianById(enrollment.guardian_id);
    const classGroup = getClassGroupById(enrollment.class_group_id);
    const course = classGroup ? getCourseById(classGroup.course_id) : undefined;

    if (!guardian || !student || !course) {
      toast({
        title: 'Erro',
        description: 'Dados incompletos para envio.',
        variant: 'destructive',
      });
      return;
    }

    // Get first name of guardian
    const guardianFirstName = guardian.name.split(' ')[0];

    // Build message from template
    let message = signatureTemplate || `Olá {nome}!\n\nO contrato de matrícula de *{aluno}* no curso *{curso}* está pronto para assinatura digital.\n\n✍️ Acesse o link abaixo para visualizar e assinar:\n{link}\n\nEste link é único e intransferível.\n\nQualquer dúvida, estamos à disposição! 🙂`;
    
    message = message
      .replace('{nome}', guardianFirstName)
      .replace('{aluno}', student.name)
      .replace('{curso}', course.name)
      .replace('{link}', link)
      .replace(/\\n/g, '\n');

    const success = await sendMessage({
      phone: guardian.phone,
      message,
    });

    if (success) {
      toast({
        title: 'Link enviado!',
        description: `Link de assinatura enviado para ${guardian.name} via WhatsApp.`,
      });
    }
  };
  // Open signature modal
  const handleOpenSignatureModal = (enrollment: typeof enrollments[0]) => {
    const contract = getContractForEnrollment(enrollment.id);
    const student = getStudentById(enrollment.student_id);
    const guardian = getGuardianById(enrollment.guardian_id);
    const classGroup = getClassGroupById(enrollment.class_group_id);
    const course = classGroup ? getCourseById(classGroup.course_id) : undefined;

    if (!contract || !student || !guardian || !course) {
      toast({
        title: 'Erro',
        description: 'Dados incompletos para assinatura.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedContractForSignature({
      id: contract.id,
      studentName: student.name,
      courseName: course.name,
      guardianName: guardian.name,
      totalValue: Number(contract.total_value),
      installments: contract.installment_count || 1,
    });
    setShowSignatureModal(true);
  };

  // Open signed contract modal
  const handleOpenSignedContractModal = (enrollment: typeof enrollments[0]) => {
    const contract = getContractForEnrollment(enrollment.id);
    const student = getStudentById(enrollment.student_id);
    const guardian = getGuardianById(enrollment.guardian_id);
    const classGroup = getClassGroupById(enrollment.class_group_id);
    const course = classGroup ? getCourseById(classGroup.course_id) : undefined;

    if (!contract || !student || !guardian || !course) {
      toast({
        title: 'Erro',
        description: 'Dados do contrato não encontrados.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedSignedContract({
      id: contract.id,
      studentName: student.name,
      guardianName: guardian.name,
      courseName: course.name,
      totalValue: Number(contract.total_value),
      installments: contract.installment_count || 1,
      signedAt: contract.signed_at || '',
      signatureHash: (contract as any).signature_hash || null,
      signatureImage: (contract as any).signature_image || null,
      signedIp: (contract as any).signed_ip || null,
      signedUserAgent: (contract as any).signed_user_agent || null,
    });
    setShowSignedContractModal(true);
  };
  const handleSignatureComplete = async () => {
    // Refetch to update the UI
    window.location.reload();
  };

  const getContractContent = (enrollmentId: string) => {
    // First check if there's a saved contract in the database
    const savedContract = contracts.find(c => c.enrollment_id === enrollmentId);
    if (savedContract?.contract_content) {
      // Add the school logo and signature data to saved contracts
      const content = savedContract.contract_content as any;
      return {
        ...content,
        schoolLogo: content.schoolLogo || branding?.logo || '',
        // Include signature fields from the contract record
        signatureImage: (savedContract as any).signature_image || content.signatureImage || null,
        signedAt: savedContract.signed_at || content.signedAt || null,
        signatureHash: (savedContract as any).signature_hash || content.signatureHash || null,
      };
    }

    // Otherwise, generate from enrollment data
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    if (!enrollment) return null;

    const student = getStudentById(enrollment.student_id);
    const guardian = getGuardianById(enrollment.guardian_id);
    const classGroup = getClassGroupById(enrollment.class_group_id);
    const course = classGroup ? getCourseById(classGroup.course_id) : undefined;
    const schedule = classGroup ? getScheduleById(classGroup.schedule_id) : undefined;

    const activeClauses = contractClauses
      .filter(c => c.is_active)
      .sort((a, b) => a.clause_order - b.clause_order);

    return {
      schoolName: contractConfig?.school_name || 'EduGestor',
      schoolCnpj: contractConfig?.school_cnpj || '',
      schoolAddress: contractConfig?.school_address || '',
      schoolLogo: branding?.logo || '',
      schoolSignatureUrl: (contractConfig as any)?.representative_signature_url || null,
      schoolRepresentativeName: (contractConfig as any)?.representative_name || null,
      guardianName: guardian?.name || '',
      guardianCpf: guardian?.cpf || '',
      guardianAddress: guardian?.address || '',
      studentName: student?.name || '',
      studentBirthDate: student?.birth_date || '',
      courseName: course?.name || '',
      courseDuration: course?.duration || '',
      coursePrice: course?.price || 0,
      classGroupName: classGroup?.name || '',
      schedule: schedule ? `${schedule.day_of_week} - ${schedule.start_time} às ${schedule.end_time}` : '',
      installments: 1,
      installmentValue: course?.price || 0,
      totalValue: course?.price || 0,
      clauses: activeClauses.map(c => ({ title: c.title, content: c.content })),
      createdAt: enrollment.enrollment_date,
    };
  };

  const handleDownloadPDF = async (enrollmentId: string) => {
    setIsGenerating(true);
    
    try {
      const content = getContractContent(enrollmentId) as (ContractContentType & {
        schoolLogo?: string;
        schoolSignatureUrl?: string | null;
        signatureImage?: string | null;
      }) | null;
      if (!content) {
        throw new Error('Contrato não encontrado');
      }

      // Pre-load all images as base64 to ensure they're embedded in the PDF
      const preloadedImages = await preloadContractImages({
        schoolLogo: content.schoolLogo,
        schoolSignatureUrl: content.schoolSignatureUrl,
        signatureImage: content.signatureImage,
      });

      // Generate PDF with pre-loaded images
      const doc = generateContractPDF({
        ...content,
        schoolLogo: preloadedImages.schoolLogo || undefined,
        schoolSignatureUrl: preloadedImages.schoolSignatureUrl,
        signatureImage: preloadedImages.signatureImage,
      });
      
      const studentName = content.studentName || 'contrato';
      doc.save(`contrato_${studentName.replace(/\s+/g, '_')}.pdf`);

      toast({
        title: 'PDF gerado',
        description: 'O contrato foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o contrato em PDF.',
        variant: 'destructive',
      });
    }
    
    setIsGenerating(false);
  };

  const handlePreview = (enrollmentId: string) => {
    const content = getContractContent(enrollmentId);
    if (content) {
      setPreviewContract(content);
      setShowPreviewModal(true);
    }
  };

  const handleOpenCarneModal = async (enrollment: typeof enrollments[0]) => {
    const contract = getContractForEnrollment(enrollment.id);
    if (!contract) {
      toast({
        title: 'Erro',
        description: 'Contrato não encontrado para esta matrícula.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedContractForCarne({ enrollment, contract });
    
    // Pre-fill with contract installments and due day from enrollment
    const contractContent = contract.contract_content as any;
    let savedDueDay = contractContent?.dueDayOfMonth;
    const savedInstallments = contract.installment_count;
    
    // Se não tiver dueDayOfMonth salvo, buscar das parcelas existentes (parcela regular, não entrada)
    if (!savedDueDay) {
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('due_date, description')
        .eq('contract_id', contract.id)
        .order('due_date', { ascending: true });
      
      if (existingPayments && existingPayments.length > 0) {
        // Priorizar parcela regular (não entrada/pro-rata)
        const regularPayment = existingPayments.find(p => 
          p.description?.includes('Parcela') && 
          !p.description?.toLowerCase().includes('entrada') &&
          !p.description?.toLowerCase().includes('pro-rata')
        );
        
        if (regularPayment) {
          // Extrair dia usando método local (evita problemas de timezone)
          const [year, month, day] = regularPayment.due_date.split('-').map(Number);
          savedDueDay = day;
        } else {
          // Se só tem entrada, usar o primeiro pagamento
          const [year, month, day] = existingPayments[0].due_date.split('-').map(Number);
          savedDueDay = day;
        }
      }
    }
    
    setCarneInstallments(savedInstallments?.toString() || '6');
    setCarneDueDay(savedDueDay?.toString() || '10');
    setShowCarneModal(true);
  };

  const handleGenerateCarne = async () => {
    if (!selectedContractForCarne) return;
    
    const { enrollment, contract } = selectedContractForCarne;
    const guardian = getGuardianById(enrollment.guardian_id);
    const student = getStudentById(enrollment.student_id);
    const classGroup = getClassGroupById(enrollment.class_group_id);
    const course = classGroup ? getCourseById(classGroup.course_id) : undefined;
    
    if (!guardian || !student || !course) {
      toast({
        title: 'Erro',
        description: 'Dados incompletos para gerar o carnê.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsGeneratingCarne(true);
    
    try {
      // 1. Create/get customer in Asaas
      let asaasCustomer;
      if (guardian.asaas_customer_id) {
        asaasCustomer = { id: guardian.asaas_customer_id };
      } else {
        asaasCustomer = await createCustomer({
          name: guardian.name,
          cpfCnpj: guardian.cpf,
          email: guardian.email,
          phone: guardian.phone,
          address: guardian.address,
          addressNumber: guardian.address_number || 'S/N',
          province: guardian.province || 'Centro',
          postalCode: guardian.postal_code || '00000000',
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
      
      // 2. Calculate values
      const installmentCount = parseInt(carneInstallments);
      const regularValue = Number(contract.total_value) / installmentCount;
      const totalValue = Number(contract.total_value);
      
      // 3. Calculate first due date
      // If selected day hasn't passed yet this month -> due this month
      // If selected day has already passed -> due next month
      const today = new Date();
      const selectedDay = parseInt(carneDueDay);
      const currentDay = today.getDate();
      
      let firstDueDate: Date;
      if (selectedDay > currentDay) {
        // Due date is this month
        firstDueDate = new Date(today.getFullYear(), today.getMonth(), selectedDay);
      } else {
        // Due date is next month (selected day already passed)
        firstDueDate = new Date(today.getFullYear(), today.getMonth() + 1, selectedDay);
      }
      
      // Format as YYYY-MM-DD using local components to avoid UTC conversion issues
      const year = firstDueDate.getFullYear();
      const month = String(firstDueDate.getMonth() + 1).padStart(2, '0');
      const day = String(firstDueDate.getDate()).padStart(2, '0');
      const firstDueDateStr = `${year}-${month}-${day}`;
      
      const description = `Mensalidade - ${course.name} - Aluno: ${student.name}`;
      
      const discountConfig = {
        value: 5,
        dueDateLimitDays: 5,
        type: 'PERCENTAGE' as const,
      };
      
      // 4. Create carnê in Asaas
      const asaasPayment = await createAsaasCarne({
        customerId: asaasCustomer.id,
        value: totalValue,
        dueDate: firstDueDateStr,
        description,
        installmentCount,
        externalReference: enrollment.id,
        discount: discountConfig,
      });
      
      if (!asaasPayment) {
        throw new Error('Erro ao criar carnê no sistema de pagamentos');
      }
      
      // 5. Save carnê to database
      await createCarne({
        enrollment_id: enrollment.id,
        guardian_id: guardian.id,
        contract_id: contract.id,
        asaas_installment_id: asaasPayment.installment || asaasPayment.id,
        description,
        total_value: totalValue,
        installment_count: installmentCount,
        first_due_date: firstDueDateStr,
      });
      
      // 6. Save first payment to database
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
      
      await refetchCarnes();
      
      toast({
        title: 'Carnê gerado com sucesso!',
        description: `${installmentCount} parcelas de R$ ${regularValue.toFixed(2).replace('.', ',')} foram criadas.`,
      });
      
      setShowCarneModal(false);
      setSelectedContractForCarne(null);
    } catch (error) {
      console.error('Error generating carnê:', error);
      toast({
        title: 'Erro ao gerar carnê',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao gerar o carnê.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingCarne(false);
    }
  };

  const dueDateOptions = [5, 10, 15, 20, 25];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Contratos</h1>
          <p className="page-subtitle">Contratos gerados das matrículas</p>
        </div>
        <Link to="/contrato-config">
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" />
            Configurar Contrato
          </Button>
        </Link>
      </div>

      {contractEnrollments.length > 0 ? (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm">
          <div className="divide-y divide-border">
            {contractEnrollments.map((enrollment) => {
              const student = getStudentById(enrollment.student_id);
              const guardian = getGuardianById(enrollment.guardian_id);
              const classGroup = getClassGroupById(enrollment.class_group_id);
              const course = classGroup ? getCourseById(classGroup.course_id) : undefined;
              const hasCarne = enrollmentHasCarne(enrollment.id);
              const isSigned = isContractSigned(enrollment.id);
              const signatureLink = getSignatureLink(enrollment.id);

              return (
                <div key={enrollment.id} className="p-6 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSigned ? 'bg-success/10' : 'bg-primary/10'}`}>
                        {isSigned ? (
                          <CheckCircle2 className="w-6 h-6 text-success" />
                        ) : (
                          <FileText className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">
                            Contrato - {student?.name}
                          </h3>
                          {isSigned ? (
                            <Badge 
                              className="bg-success/10 text-success border-success/30 cursor-pointer hover:bg-success/20 transition-colors"
                              onClick={() => handleOpenSignedContractModal(enrollment)}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Assinado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Pendente Assinatura
                            </Badge>
                          )}
                          {!hasCarne && (
                            <Badge variant="outline" className="text-warning border-warning/30">
                              Sem Carnê
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {course?.name} • {classGroup?.name}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {guardian?.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(enrollment.enrollment_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {!isSigned && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="default" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleOpenSignatureModal(enrollment)}
                              >
                                <PenLine className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Assinar contrato</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => copySignatureLink(enrollment.id)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copiar link de assinatura</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                onClick={() => handleSendSignatureLinkWhatsApp(enrollment)}
                                disabled={isSendingWhatsApp}
                              >
                                {isSendingWhatsApp ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MessageCircle className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Enviar link via WhatsApp</p>
                            </TooltipContent>
                          </Tooltip>
                        </>
                      )}
                      {!hasCarne && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="default" 
                              size="icon" 
                              className="h-8 w-8 bg-success hover:bg-success/90"
                              onClick={() => handleOpenCarneModal(enrollment)}
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Gerar carnê</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handlePreview(enrollment.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Visualizar contrato</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => handleDownloadPDF(enrollment.id)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Baixar PDF</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum contrato gerado</h3>
          <p className="text-muted-foreground mb-4">
            Os contratos são gerados automaticamente ao finalizar uma matrícula
          </p>
          <Link to="/matricula">
            <Button>Nova Matrícula</Button>
          </Link>
        </div>
      )}

      {/* Preview Modal - Same layout as Enrollment */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualização do Contrato</DialogTitle>
          </DialogHeader>
          {previewContract && (
            <div className="space-y-4">
              {/* Print preview using the same component as Enrollment */}
              <div className="border rounded-lg overflow-hidden">
                <ContractPrintView ref={contractPrintRef} content={previewContract} />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    const printContent = contractPrintRef.current;
                    if (printContent) {
                      const printWindow = window.open('', '', 'width=800,height=600');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Contrato - ${previewContract.studentName}</title>
                              <style>
                                @page { size: A4; margin: 12mm; }
                                body { margin: 0; padding: 0; }
                                .contract-page { page-break-after: always; }
                                .annex-page { page-break-before: always; }
                              </style>
                            </head>
                            <body>${printContent.innerHTML}</body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                      }
                    }
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button onClick={() => {
                  handleDownloadPDF(contractEnrollments.find(e => 
                    getStudentById(e.student_id)?.name === previewContract.studentName
                  )?.id || '');
                  setShowPreviewModal(false);
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Carnê Generation Modal */}
      <Dialog open={showCarneModal} onOpenChange={setShowCarneModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Gerar Carnê de Pagamento
            </DialogTitle>
            <DialogDescription>
              Configure as parcelas para gerar o carnê desta matrícula.
            </DialogDescription>
          </DialogHeader>
          
          {selectedContractForCarne && (
            <div className="space-y-6">
              {/* Contract Info */}
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Aluno</p>
                <p className="font-medium">{getStudentById(selectedContractForCarne.enrollment.student_id)?.name}</p>
                <p className="text-sm text-muted-foreground mt-2">Valor Total do Contrato</p>
                <p className="text-xl font-bold text-primary">
                  R$ {Number(selectedContractForCarne.contract.total_value).toFixed(2).replace('.', ',')}
                </p>
              </div>
              
              {/* Installment Config */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Select value={carneInstallments} onValueChange={setCarneInstallments}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}x de R$ {(Number(selectedContractForCarne.contract.total_value) / n).toFixed(2).replace('.', ',')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Dia de Vencimento</Label>
                  <Select value={carneDueDay} onValueChange={setCarneDueDay}>
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
                </div>
              </div>
              
              {/* Summary */}
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Parcelas</span>
                  <span className="font-medium">{carneInstallments}x</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Valor da Parcela</span>
                  <span className="font-medium">
                    R$ {(Number(selectedContractForCarne.contract.total_value) / parseInt(carneInstallments)).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                  <span className="font-medium">Primeiro Vencimento</span>
                  <span className="font-medium text-primary">
                    {(() => {
                      const today = new Date();
                      const selectedDay = parseInt(carneDueDay);
                      const currentDay = today.getDate();
                      // If selected day hasn't passed yet this month -> due this month
                      // If selected day has already passed -> due next month
                      const firstDue = selectedDay > currentDay 
                        ? new Date(today.getFullYear(), today.getMonth(), selectedDay)
                        : new Date(today.getFullYear(), today.getMonth() + 1, selectedDay);
                      return firstDue.toLocaleDateString('pt-BR');
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCarneModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerateCarne} 
              disabled={isGeneratingCarne || isAsaasLoading}
              className="gap-2"
            >
              {(isGeneratingCarne || isAsaasLoading) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Gerar Carnê
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Modal */}
      <SignatureModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        contract={selectedContractForSignature}
        onSignatureComplete={handleSignatureComplete}
      />

      {/* Signed Contract Details Modal */}
      <SignedContractModal
        open={showSignedContractModal}
        onOpenChange={setShowSignedContractModal}
        contract={selectedSignedContract}
        onPrint={() => {
          if (selectedSignedContract) {
            const enrollment = contractEnrollments.find(e => 
              getContractForEnrollment(e.id)?.id === selectedSignedContract.id
            );
            if (enrollment) {
              handlePreview(enrollment.id);
              setShowSignedContractModal(false);
            }
          }
        }}
        onDownload={() => {
          if (selectedSignedContract) {
            const enrollment = contractEnrollments.find(e => 
              getContractForEnrollment(e.id)?.id === selectedSignedContract.id
            );
            if (enrollment) {
              handleDownloadPDF(enrollment.id);
              setShowSignedContractModal(false);
            }
          }
        }}
      />
    </div>
  );
}
