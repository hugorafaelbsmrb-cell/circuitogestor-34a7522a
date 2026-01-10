import { Check, Printer, Eye, FileText, CreditCard, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface EnrollmentData {
  student: { name: string; birthDate: string };
  guardian: { 
    name: string; 
    cpf: string; 
    email: string; 
    phone: string; 
    address: string;
    addressNumber: string;
    province: string;
    postalCode: string;
  };
  course: { name: string; duration: string; price: number } | null;
  classGroup: { name: string } | null;
  schedule: { day_of_week: string; start_time: string; end_time: string } | null;
  payment: { installments: string; dueDate: string };
  contract: {
    id: string;
    content: any;
  } | null;
  carne: {
    id: string;
    asaasInstallmentId: string;
  } | null;
}

interface EnrollmentSummaryProps {
  data: EnrollmentData;
  onPrintContract: () => void;
  onViewContract: () => void;
  onPrintCarne: () => void;
  onViewCarne: () => void;
  onNewEnrollment: () => void;
  onGoToContracts: () => void;
  isLoadingCarne?: boolean;
}

export function EnrollmentSummary({
  data,
  onPrintContract,
  onViewContract,
  onPrintCarne,
  onViewCarne,
  onNewEnrollment,
  onGoToContracts,
  isLoadingCarne = false,
}: EnrollmentSummaryProps) {
  const totalValue = data.course 
    ? data.course.price * parseInt(data.payment.installments) 
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Success Banner */}
      <div className="bg-success/10 border border-success/20 rounded-xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Matrícula Realizada com Sucesso!</h2>
          <p className="text-muted-foreground">
            O contrato e o carnê de pagamento foram gerados automaticamente.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              Dados do Aluno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Nome:</span>
              <span className="font-medium text-sm">{data.student.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Data de Nascimento:</span>
              <span className="font-medium text-sm">
                {data.student.birthDate ? new Date(data.student.birthDate).toLocaleDateString('pt-BR') : '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Guardian Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              Responsável Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Nome:</span>
              <span className="font-medium text-sm">{data.guardian.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">CPF:</span>
              <span className="font-medium text-sm">{data.guardian.cpf}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">E-mail:</span>
              <span className="font-medium text-sm">{data.guardian.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Telefone:</span>
              <span className="font-medium text-sm">{data.guardian.phone}</span>
            </div>
          </CardContent>
        </Card>

        {/* Course Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              Curso e Turma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Curso:</span>
              <span className="font-medium text-sm">{data.course?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Duração:</span>
              <span className="font-medium text-sm">{data.course?.duration || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Turma:</span>
              <span className="font-medium text-sm">{data.classGroup?.name || '-'}</span>
            </div>
            {data.schedule && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Horário:</span>
                <span className="font-medium text-sm">
                  {data.schedule.day_of_week} • {data.schedule.start_time} às {data.schedule.end_time}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Mensalidade:</span>
              <span className="font-medium text-sm">
                R$ {data.course ? data.course.price.toFixed(2).replace('.', ',') : '0,00'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Parcelas:</span>
              <span className="font-medium text-sm">{data.payment.installments}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Primeiro Vencimento:</span>
              <span className="font-medium text-sm">
                {new Date(data.payment.dueDate).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-foreground font-medium">Valor Total:</span>
              <span className="font-bold text-primary text-lg">
                R$ {totalValue.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contract Actions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Contrato de Matrícula
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contrato gerado em nome de {data.guardian.name}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={onViewContract}>
                <Eye className="w-4 h-4" />
                Visualizar
              </Button>
              <Button className="flex-1 gap-2" onClick={onPrintContract}>
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Carne Actions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Carnê de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {data.payment.installments} boletos gerados para pagamento
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 gap-2" 
                onClick={onViewCarne}
                disabled={isLoadingCarne}
              >
                {isLoadingCarne ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Visualizar
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={onPrintCarne}
                disabled={isLoadingCarne}
              >
                {isLoadingCarne ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Baixar PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button variant="outline" className="flex-1" onClick={onNewEnrollment}>
          Nova Matrícula
        </Button>
        <Button className="flex-1" onClick={onGoToContracts}>
          Ver Contratos
        </Button>
      </div>
    </div>
  );
}
