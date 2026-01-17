import { useState } from 'react';
import { FileText, Download, Calendar, User, Settings, Eye, Loader2 } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateContractPDF } from '@/utils/pdfGenerator';
import { useToast } from '@/hooks/use-toast';

export default function Contracts() {
  const { toast } = useToast();
  const { enrollments, contracts, contractClauses, getStudentById, getGuardianById, getClassGroupById, getCourseById, getScheduleById, contractConfig } = useSchool();
  const { branding } = useSystemBranding();
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewContract, setPreviewContract] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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

  const getContractContent = (enrollmentId: string) => {
    // First check if there's a saved contract in the database
    const savedContract = contracts.find(c => c.enrollment_id === enrollmentId);
    if (savedContract?.contract_content) {
      // Add the school logo to saved contracts that don't have it
      const content = savedContract.contract_content as any;
      return {
        ...content,
        schoolLogo: content.schoolLogo || branding?.logo || '',
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
      const content = getContractContent(enrollmentId) as ContractContentType | null;
      if (!content) {
        throw new Error('Contrato não encontrado');
      }

      const doc = generateContractPDF(content);
      const studentName = content.studentName || 'contrato';
      doc.save(`contrato_${studentName.replace(/\s+/g, '_')}.pdf`);

      toast({
        title: 'PDF gerado',
        description: 'O contrato foi baixado com sucesso.',
      });
    } catch (error) {
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

              return (
                <div key={enrollment.id} className="p-6 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Contrato - {student?.name}
                        </h3>
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
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => handlePreview(enrollment.id)}
                      >
                        <Eye className="w-4 h-4" />
                        Visualizar
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-2" 
                        onClick={() => handleDownloadPDF(enrollment.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        PDF
                      </Button>
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

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualização do Contrato</DialogTitle>
          </DialogHeader>
          {previewContract && (
            <div className="space-y-4 text-sm">
              <div className="border-b pb-4">
                <h3 className="font-bold text-lg mb-2">CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS</h3>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">CONTRATADO:</h4>
                <p>{previewContract.schoolName}</p>
                <p>CNPJ: {previewContract.schoolCnpj || '-'}</p>
                <p>Endereço: {previewContract.schoolAddress || '-'}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">CONTRATANTE:</h4>
                <p>Nome: {previewContract.guardianName}</p>
                <p>CPF: {previewContract.guardianCpf}</p>
                <p>Endereço: {previewContract.guardianAddress}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">ALUNO:</h4>
                <p>Nome: {previewContract.studentName}</p>
                <p>Data de Nascimento: {previewContract.studentBirthDate ? new Date(previewContract.studentBirthDate).toLocaleDateString('pt-BR') : '-'}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">CURSO:</h4>
                <p>Nome: {previewContract.courseName}</p>
                <p>Duração: {previewContract.courseDuration}</p>
                <p>Turma: {previewContract.classGroupName}</p>
                <p>Horário: {previewContract.schedule}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">VALOR:</h4>
                <p>Mensalidade: R$ {Number(previewContract.installmentValue).toFixed(2).replace('.', ',')}</p>
                <p>Parcelas: {previewContract.installments}x</p>
                <p>Valor Total: R$ {Number(previewContract.totalValue).toFixed(2).replace('.', ',')}</p>
              </div>

              {previewContract.clauses && previewContract.clauses.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-semibold">CLÁUSULAS:</h4>
                  {previewContract.clauses.map((clause: any, index: number) => (
                    <div key={index}>
                      <p className="font-medium">Cláusula {index + 1}ª - {clause.title}</p>
                      <p className="text-muted-foreground">{clause.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 flex justify-end">
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
    </div>
  );
}
