import { FileText, Download, Calendar, User, Settings } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Contracts() {
  const { enrollments, contractClauses, getStudentById, getGuardianById, getClassGroupById, getCourseById, getScheduleById, contractConfig } = useSchool();

  const contractEnrollments = enrollments.filter(e => e.contract_generated);

  const handleDownload = (enrollmentId: string) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    if (!enrollment) return;

    const student = getStudentById(enrollment.student_id);
    const guardian = getGuardianById(enrollment.guardian_id);
    const classGroup = getClassGroupById(enrollment.class_group_id);
    const course = classGroup ? getCourseById(classGroup.course_id) : undefined;
    const schedule = classGroup ? getScheduleById(classGroup.schedule_id) : undefined;

    const activeClauses = contractClauses
      .filter(c => c.is_active)
      .sort((a, b) => a.clause_order - b.clause_order);

    const clausesText = activeClauses
      .map((clause, index) => `Cláusula ${index + 1}ª - ${clause.title}\n${clause.content}`)
      .join('\n\n');

    const contractContent = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS

================================================================================

CONTRATADO:
${contractConfig?.school_name || ''}
CNPJ: ${contractConfig?.school_cnpj || ''}
Endereço: ${contractConfig?.school_address || ''}

================================================================================

CONTRATANTE (Responsável Financeiro):
Nome: ${guardian?.name}
CPF: ${guardian?.cpf}
E-mail: ${guardian?.email}
Telefone: ${guardian?.phone}
Endereço: ${guardian?.address}

================================================================================

ALUNO:
Nome: ${student?.name}
Data de Nascimento: ${student?.birth_date ? new Date(student.birth_date).toLocaleDateString('pt-BR') : '-'}

================================================================================

CURSO:
Nome: ${course?.name}
Descrição: ${course?.description}
Duração: ${course?.duration}
Turma: ${classGroup?.name}
Horário: ${schedule ? `${schedule.day_of_week} - ${schedule.start_time} às ${schedule.end_time}` : '-'}

================================================================================

VALOR:
Mensalidade: R$ ${course?.price.toFixed(2).replace('.', ',')}

================================================================================

Data da Matrícula: ${new Date(enrollment.enrollment_date).toLocaleDateString('pt-BR')}

================================================================================

CLÁUSULAS CONTRATUAIS

${clausesText}

================================================================================

Local e Data: _________________________________, ___/___/_______


_______________________________          _______________________________
        CONTRATANTE                              CONTRATADO
    `;

    const blob = new Blob([contractContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato_${student?.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownload(enrollment.id)}>
                        <Download className="w-4 h-4" />
                        Download
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
    </div>
  );
}
