import { useState } from 'react';
import { CreditCard, FileText, Plus, Search, Loader2, ExternalLink, Copy, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/contexts/SchoolContext';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { useToast } from '@/hooks/use-toast';
import type { AsaasPayment } from '@/types/school';
import { cn } from '@/lib/utils';

export default function Payments() {
  const { guardians, enrollments, courses, getCourseById, getClassGroupById, getStudentById } = useSchool();
  const { isLoading, createCustomer, createPayment, createCarne } = useAsaasPayment();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatedPayments, setGeneratedPayments] = useState<AsaasPayment[]>([]);
  
  const [paymentForm, setPaymentForm] = useState({
    guardianId: '',
    enrollmentId: '',
    installments: '1',
    dueDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
  });

  const filteredGuardians = guardians.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.cpf.includes(searchTerm)
  );

  const selectedGuardian = guardians.find(g => g.id === paymentForm.guardianId);
  const guardianEnrollments = enrollments.filter(e => e.guardian_id === paymentForm.guardianId);
  const selectedEnrollment = enrollments.find(e => e.id === paymentForm.enrollmentId);
  const selectedClassGroup = selectedEnrollment ? getClassGroupById(selectedEnrollment.class_group_id) : undefined;
  const selectedCourse = selectedClassGroup ? getCourseById(selectedClassGroup.course_id) : undefined;

  const handleGeneratePayment = async () => {
    if (!selectedGuardian || !selectedCourse) return;

    // Parse address components (simplified - in production you'd have separate fields)
    const addressParts = selectedGuardian.address.split(',');
    const address = addressParts[0]?.trim() || 'Não informado';
    
    // Create customer in Asaas
    const customer = await createCustomer({
      name: selectedGuardian.name,
      cpfCnpj: selectedGuardian.cpf,
      email: selectedGuardian.email,
      phone: selectedGuardian.phone,
      address: address,
      addressNumber: selectedGuardian.address_number || 'S/N',
      province: selectedGuardian.province || 'Centro',
      postalCode: selectedGuardian.postal_code || '00000000',
    });

    if (!customer) return;

    const installmentCount = parseInt(paymentForm.installments);
    const student = selectedEnrollment ? getStudentById(selectedEnrollment.student_id) : undefined;
    const description = `Mensalidade - ${selectedCourse.name} - Aluno: ${student?.name || 'N/A'}`;

    let payment: AsaasPayment | null;

    if (installmentCount > 1) {
      payment = await createCarne({
        customerId: customer.id,
        value: selectedCourse.price * installmentCount,
        dueDate: paymentForm.dueDate,
        description,
        installmentCount,
        externalReference: selectedEnrollment?.id,
      });
    } else {
      payment = await createPayment({
        customerId: customer.id,
        value: selectedCourse.price,
        dueDate: paymentForm.dueDate,
        description,
        externalReference: selectedEnrollment?.id,
      });
    }

    if (payment) {
      setGeneratedPayments(prev => [payment!, ...prev]);
      setIsDialogOpen(false);
      setPaymentForm({
        guardianId: '',
        enrollmentId: '',
        installments: '1',
        dueDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Código copiado para a área de transferência.',
    });
  };

  const getStatusBadge = (status: AsaasPayment['status']) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      PENDING: { label: 'Pendente', variant: 'secondary', icon: Clock },
      RECEIVED: { label: 'Recebido', variant: 'default', icon: CheckCircle2 },
      CONFIRMED: { label: 'Confirmado', variant: 'default', icon: CheckCircle2 },
      OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Pagamentos</h1>
          <p className="page-subtitle">Gerencie boletos e cobranças via Asaas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Gerar Boleto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Gerar Novo Boleto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Responsável Financeiro</Label>
                <Select
                  value={paymentForm.guardianId}
                  onValueChange={(value) => setPaymentForm(prev => ({ ...prev, guardianId: value, enrollmentId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {guardians.map((guardian) => (
                      <SelectItem key={guardian.id} value={guardian.id}>
                        {guardian.name} - {guardian.cpf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentForm.guardianId && (
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Select
                    value={paymentForm.enrollmentId}
                    onValueChange={(value) => setPaymentForm(prev => ({ ...prev, enrollmentId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a matrícula" />
                    </SelectTrigger>
                    <SelectContent>
                      {guardianEnrollments.map((enrollment) => {
                        const student = getStudentById(enrollment.student_id);
                        const classGroup = getClassGroupById(enrollment.class_group_id);
                        const course = classGroup ? getCourseById(classGroup.course_id) : undefined;
                        return (
                          <SelectItem key={enrollment.id} value={enrollment.id}>
                            {student?.name} - {course?.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedCourse && (
                <div className="bg-secondary/30 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor do curso</span>
                    <span className="font-semibold text-primary">
                      R$ {selectedCourse.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select
                    value={paymentForm.installments}
                    onValueChange={(value) => setPaymentForm(prev => ({ ...prev, installments: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}x {selectedCourse && `de R$ ${(selectedCourse.price / n).toFixed(2).replace('.', ',')}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input
                    type="date"
                    value={paymentForm.dueDate}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              <Button 
                className="w-full gap-2" 
                onClick={handleGeneratePayment}
                disabled={!selectedEnrollment || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {isLoading ? 'Gerando...' : 'Gerar Boleto'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Generated Payments */}
      {generatedPayments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Boletos Gerados</h2>
          <div className="space-y-4">
            {generatedPayments.map((payment) => (
              <div 
                key={payment.id} 
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Vencimento: {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        R$ {payment.value.toFixed(2).replace('.', ',')}
                      </p>
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="flex gap-2">
                      {payment.bankSlipUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(payment.bankSlipUrl, '_blank')}
                          className="gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Ver Boleto
                        </Button>
                      )}
                      {payment.invoiceUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(payment.invoiceUrl, '_blank')}
                          className="gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          Fatura
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {generatedPayments.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Nenhum boleto gerado</h3>
          <p className="text-muted-foreground mb-4">
            Gere boletos para os responsáveis financeiros das matrículas.
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Gerar Primeiro Boleto
          </Button>
        </div>
      )}
    </div>
  );
}
