import { useState } from 'react';
import { Check, Printer, Eye, FileText, CreditCard, Download, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  classGroup?: { name: string } | null;
  schedule: string | { day_of_week: string; start_time: string; end_time: string } | null;
  gradeLevel?: { id: string; label: string; description: string } | null;
  payment: { 
    installments: number; 
    dueDayOfMonth: number;
    firstDueDate: string;
    entryBoletoDueDate?: string; // Data de vencimento do boleto de entrada
    proRataValue: number;
    regularValue: number;
    total: number;
  };
  contract: {
    id: string;
    content: any;
  } | null;
  carne: {
    id: string;
    asaasInstallmentId: string;
  } | null;
  proRataBoleto: {
    id: string;
    invoiceUrl: string | null;
    bankSlipUrl: string | null;
  } | null;
}

interface EnrollmentSummaryProps {
  data: EnrollmentData;
  onPrintContract: () => void;
  onViewCarne: () => void;
  onDownloadCarne: () => void;
  onViewProRataBoleto: () => void;
  onDownloadProRataBoleto: () => void;
  onNewEnrollment: () => void;
  isLoadingCarne?: boolean;
}

export function EnrollmentSummary({
  data,
  onPrintContract,
  onViewCarne,
  onDownloadCarne,
  onViewProRataBoleto,
  onDownloadProRataBoleto,
  onNewEnrollment,
  isLoadingCarne = false,
}: EnrollmentSummaryProps) {
  const { toast } = useToast();
  const { sendMessage, checkConfig } = useWapiMessage();
  const [isSendingBoleto, setIsSendingBoleto] = useState(false);
  const [isSendingCarne, setIsSendingCarne] = useState(false);
  const [boletoSent, setBoletoSent] = useState(false);
  const [carneSent, setCarneSent] = useState(false);
  
  const totalValue = data.payment.total;
  const hasProRataBoleto = data.proRataBoleto && (data.proRataBoleto.invoiceUrl || data.proRataBoleto.bankSlipUrl);

  const sendEntryBoletoViaWhatsApp = async () => {
    if (!hasProRataBoleto || !data.guardian.phone) return;
    
    setIsSendingBoleto(true);
    try {
      const config = await checkConfig();
      if (!config.isConfigured) {
        toast({
          title: 'W-API não configurada',
          description: 'Configure a W-API em Configurações > WhatsApp.',
          variant: 'destructive',
        });
        return;
      }

      // Get school name
      const { data: schoolConfig } = await supabase
        .from('contract_config')
        .select('school_name')
        .single();
      
      const schoolName = schoolConfig?.school_name || 'Nossa Escola';
      const boletoUrl = data.proRataBoleto?.invoiceUrl || data.proRataBoleto?.bankSlipUrl || '';
      const formattedValue = `R$ ${data.payment.proRataValue.toFixed(2).replace('.', ',')}`;
      const formattedDate = data.payment.entryBoletoDueDate 
        ? format(new Date(data.payment.entryBoletoDueDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
        : format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
      const firstName = data.guardian.name.split(' ')[0];

      const message = `Olá, ${firstName}! 📄\n\nSegue o *boleto de entrada* referente à matrícula de *${data.student.name}* no curso *${data.course?.name || 'não informado'}*.\n\n💰 *Valor:* ${formattedValue}\n📅 *Vencimento:* ${formattedDate}\n\n🏫 *${schoolName}*\n\n📎 Acesse o boleto:\n${boletoUrl}`;

      const success = await sendMessage({
        phone: data.guardian.phone,
        message,
      });

      if (success) {
        setBoletoSent(true);
        toast({
          title: 'Boleto enviado!',
          description: 'O boleto de entrada foi enviado via WhatsApp.',
        });
      }
    } catch (error) {
      console.error('Error sending boleto:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o boleto.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingBoleto(false);
    }
  };

  const sendCarneViaWhatsApp = async () => {
    if (!data.carne || !data.guardian.phone) return;
    
    setIsSendingCarne(true);
    try {
      const config = await checkConfig();
      if (!config.isConfigured) {
        toast({
          title: 'W-API não configurada',
          description: 'Configure a W-API em Configurações > WhatsApp.',
          variant: 'destructive',
        });
        return;
      }

      // Get school name
      const { data: schoolConfig } = await supabase
        .from('contract_config')
        .select('school_name')
        .single();
      
      const schoolName = schoolConfig?.school_name || 'Nossa Escola';
      
      // Fetch carne payments to get the invoice URLs
      const { data: carnePayments } = await supabase
        .from('payments')
        .select('id, value, due_date, invoice_url, bank_slip_url, installment_number')
        .eq('asaas_installment_id', data.carne?.asaasInstallmentId)
        .order('due_date', { ascending: true })
        .limit(3);
      
      const firstName = data.guardian.name.split(' ')[0];
      const installmentCount = hasProRataBoleto 
        ? (data.payment.installments || 12) - 1 
        : data.payment.installments || 12;
      
      let message = `Olá, ${firstName}! 📋\n\nSegue o *carnê de pagamento* referente à matrícula de *${data.student.name}* no curso *${data.course?.name || 'não informado'}*.\n\n📊 *${installmentCount} parcelas* de R$ ${data.payment.regularValue.toFixed(2).replace('.', ',')}\n📅 *Início:* ${format(new Date(data.payment.firstDueDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}\n\n🏫 *${schoolName}*`;

      // Add first payment links if available
      if (carnePayments && carnePayments.length > 0) {
        message += '\n\n📎 *Próximos boletos:*';
        for (const payment of carnePayments.slice(0, 3)) {
          const paymentUrl = payment.invoice_url || payment.bank_slip_url;
          if (paymentUrl) {
            const dueDate = format(new Date(payment.due_date), 'dd/MM', { locale: ptBR });
            message += `\n• Parcela ${payment.installment_number || ''} (${dueDate}): ${paymentUrl}`;
          }
        }
        if (carnePayments.length > 3) {
          message += `\n\n_Os demais boletos serão enviados próximo ao vencimento._`;
        }
      }

      const success = await sendMessage({
        phone: data.guardian.phone,
        message,
      });

      if (success) {
        setCarneSent(true);
        toast({
          title: 'Carnê enviado!',
          description: 'Os links do carnê foram enviados via WhatsApp.',
        });
      }
    } catch (error) {
      console.error('Error sending carne:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o carnê.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingCarne(false);
    }
  };
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
            {data.carne 
              ? "O contrato e o carnê de pagamento foram gerados automaticamente."
              : "O contrato foi gerado. O carnê poderá ser gerado na página de Contratos."}
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
            {data.gradeLevel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Série:</span>
                <span className="font-medium text-sm">{data.gradeLevel.label}</span>
              </div>
            )}
            {data.schedule && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Horário:</span>
                <span className="font-medium text-sm">
                  {typeof data.schedule === 'string' 
                    ? data.schedule 
                    : `${data.schedule.day_of_week} • ${data.schedule.start_time} às ${data.schedule.end_time}`}
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
            {hasProRataBoleto && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Boleto de Entrada:</span>
                  <span className="font-medium text-sm">
                    R$ {data.payment.proRataValue.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Vencimento Entrada:</span>
                  <span className="font-medium text-sm">
                    {data.payment.entryBoletoDueDate 
                      ? new Date(data.payment.entryBoletoDueDate + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '-'}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Duração do Contrato:</span>
              <span className="font-medium text-sm">
                {data.payment.installments === 0 || data.payment.installments === 12 && !hasProRataBoleto
                  ? 'Indeterminado'
                  : `${data.payment.installments} meses`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {hasProRataBoleto ? 'Demais Parcelas:' : 'Parcelas:'}
              </span>
              <span className="font-medium text-sm">
                {hasProRataBoleto 
                  ? `${(data.payment.installments || 12) - 1}x de R$ ${data.payment.regularValue.toFixed(2).replace('.', ',')}`
                  : `${data.payment.installments || 12}x de R$ ${data.payment.regularValue.toFixed(2).replace('.', ',')}`
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {hasProRataBoleto ? 'Vencimento Carnê:' : 'Primeiro Vencimento:'}
              </span>
              <span className="font-medium text-sm">
                {new Date(data.payment.firstDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Dia de Vencimento:</span>
              <span className="font-medium text-sm">Dia {data.payment.dueDayOfMonth}</span>
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
              <Button className="flex-1 gap-2" onClick={onPrintContract}>
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pro-Rata Boleto Actions */}
        {hasProRataBoleto && (
          <Card className="border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Boleto de Entrada (1ª Parcela)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Boleto avulso de R$ {data.payment.proRataValue.toFixed(2).replace('.', ',')} para o primeiro vencimento
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  className="flex-1 gap-2" 
                  onClick={onViewProRataBoleto}
                >
                  <Eye className="w-4 h-4" />
                  Visualizar
                </Button>
                <Button 
                  className="flex-1 gap-2" 
                  onClick={onDownloadProRataBoleto}
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Carne Actions */}
        {data.carne ? (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Carnê de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {hasProRataBoleto 
                  ? `${(data.payment.installments || 12) - 1} boletos (parcelas 2 a ${data.payment.installments || 12})`
                  : `${data.payment.installments || 12} boletos gerados para pagamento`}
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
                  onClick={onDownloadCarne}
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
        ) : (
          <Card className="border-warning/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-warning" />
                Carnê de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                O carnê não foi gerado no ato da matrícula. Você pode gerá-lo posteriormente na página de <strong>Contratos</strong>.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  disabled
                >
                  <CreditCard className="w-4 h-4" />
                  Gerar na página de Contratos
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* WhatsApp Sending Actions */}
      {(hasProRataBoleto || data.carne) && (
        <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Enviar via WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Envie os boletos diretamente para o responsável via WhatsApp. O telefone cadastrado é: <strong>{data.guardian.phone}</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {hasProRataBoleto && (
                <Button 
                  variant="outline"
                  className="flex-1 gap-2 border-emerald-500/50 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  onClick={sendEntryBoletoViaWhatsApp}
                  disabled={isSendingBoleto || boletoSent}
                >
                  {isSendingBoleto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : boletoSent ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {boletoSent ? 'Boleto Enviado' : 'Enviar Boleto de Entrada'}
                </Button>
              )}
              {data.carne && (
                <Button 
                  variant="outline"
                  className="flex-1 gap-2 border-emerald-500/50 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  onClick={sendCarneViaWhatsApp}
                  disabled={isSendingCarne || carneSent}
                >
                  {isSendingCarne ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : carneSent ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {carneSent ? 'Carnê Enviado' : 'Enviar Links do Carnê'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button className="flex-1" onClick={onNewEnrollment}>
          Nova Matrícula
        </Button>
      </div>
    </div>
  );
}
