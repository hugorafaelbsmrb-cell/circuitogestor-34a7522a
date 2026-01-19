import { useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Eye, 
  Download, 
  Trash2, 
  RefreshCw,
  Loader2,
  Calendar,
  User,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { useToast } from '@/hooks/use-toast';

interface CarnePayment {
  id: string;
  installmentNumber: number;
  value: number;
  netValue?: number;
  dueDate: string;
  status: string;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  description?: string;
}

export default function Carnes() {
  const { carnes, guardians, payments, getGuardianById, deleteCarne, refetchCarnes } = useSchool();
  const { profile } = useAuthContext();
  const { getInstallmentBooklet, listInstallmentPayments, deleteInstallment, refundInstallment, receiveInCash, isLoading: isAsaasLoading } = useAsaasPayment();
  const { toast } = useToast();

  const isAdmin = profile?.role === 'admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCarne, setSelectedCarne] = useState<typeof carnes[0] | null>(null);
  const [carnePayments, setCarnePayments] = useState<CarnePayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [carneToDelete, setCarneToDelete] = useState<typeof carnes[0] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);

  // Calculate real status based on payments for each carnê
  const getCarneRealStatus = (carne: typeof carnes[0]) => {
    const carnePaymentsList = payments.filter(p => 
      p.asaas_installment_id === carne.asaas_installment_id
    );
    
    if (carnePaymentsList.length === 0) {
      return carne.status; // Return original status if no payments found
    }
    
    const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    const allPaid = carnePaymentsList.every(p => paidStatuses.includes(p.status));
    const hasOverdue = carnePaymentsList.some(p => p.status === 'OVERDUE');
    
    if (allPaid && carnePaymentsList.length === carne.installment_count) {
      return 'ENDED'; // Only ENDED when all installments are paid
    } else if (hasOverdue) {
      return 'OVERDUE';
    } else if (carne.status === 'DELETED') {
      return 'DELETED';
    } else {
      return 'ACTIVE'; // Still active if not all paid
    }
  };

  // Filter carnês with calculated status
  const filteredCarnes = carnes.filter(carne => {
    const guardian = getGuardianById(carne.guardian_id);
    const matchesSearch = 
      guardian?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      carne.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      carne.asaas_installment_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const realStatus = getCarneRealStatus(carne);
    const matchesStatus = statusFilter === 'all' || realStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats with real status
  const stats = {
    total: carnes.length,
    active: carnes.filter(c => getCarneRealStatus(c) === 'ACTIVE').length,
    ended: carnes.filter(c => getCarneRealStatus(c) === 'ENDED').length,
    overdue: carnes.filter(c => getCarneRealStatus(c) === 'OVERDUE').length,
    totalValue: carnes.reduce((sum, c) => sum + c.total_value, 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'ENDED':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Finalizado</Badge>;
      case 'OVERDUE':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Em Atraso</Badge>;
      case 'DELETED':
        return <Badge variant="destructive">Excluído</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED':
      case 'RECEIVED_IN_CASH':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>;
      case 'PENDING':
        return <Badge className="bg-warning/10 text-warning border-warning/20"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'OVERDUE':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Vencido</Badge>;
      case 'REFUNDED':
        return <Badge variant="outline"><RefreshCw className="w-3 h-3 mr-1" />Estornado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewDetails = async (carne: typeof carnes[0]) => {
    setSelectedCarne(carne);
    setShowDetailsModal(true);
    setIsLoadingPayments(true);
    
    try {
      // First try to get payments from Asaas API
      const asaasPayments = await listInstallmentPayments(carne.asaas_installment_id);
      
      if (asaasPayments && asaasPayments.length > 0) {
        // Use Asaas data for real-time status
        const carnePaymentsList = asaasPayments.map((p: any) => ({
          id: p.id,
          installmentNumber: p.installmentNumber || 0,
          value: p.value,
          netValue: p.netValue,
          dueDate: p.dueDate,
          status: p.status,
          paymentDate: p.paymentDate || undefined,
          invoiceUrl: p.invoiceUrl,
          bankSlipUrl: p.bankSlipUrl,
          description: p.description,
        })).sort((a: CarnePayment, b: CarnePayment) => a.installmentNumber - b.installmentNumber);
        
        setCarnePayments(carnePaymentsList);
      } else {
        // Fallback to local database
        const carnePaymentsList = payments.filter(p => 
          p.asaas_installment_id === carne.asaas_installment_id
        ).map(p => ({
          id: p.id,
          installmentNumber: p.installment_number || 0,
          value: p.value,
          dueDate: p.due_date,
          status: p.status,
          paymentDate: p.payment_date || undefined,
          invoiceUrl: p.invoice_url || undefined,
          bankSlipUrl: p.bank_slip_url || undefined,
          description: p.description,
        })).sort((a, b) => a.installmentNumber - b.installmentNumber);
        
        setCarnePayments(carnePaymentsList);
      }
    } catch (error) {
      console.error('Error fetching carne payments:', error);
      // Fallback to local database on error
      const carnePaymentsList = payments.filter(p => 
        p.asaas_installment_id === carne.asaas_installment_id
      ).map(p => ({
        id: p.id,
        installmentNumber: p.installment_number || 0,
        value: p.value,
        dueDate: p.due_date,
        status: p.status,
        paymentDate: p.payment_date || undefined,
        invoiceUrl: p.invoice_url || undefined,
        bankSlipUrl: p.bank_slip_url || undefined,
        description: p.description,
      })).sort((a, b) => a.installmentNumber - b.installmentNumber);
      
      setCarnePayments(carnePaymentsList);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleDownloadPdf = async (carne: typeof carnes[0]) => {
    setIsLoadingPdf(true);
    try {
      const booklet = await getInstallmentBooklet(carne.asaas_installment_id);
      if (booklet?.pdfBase64) {
        // Convert base64 to blob and download
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
        link.download = `carne_${carne.asaas_installment_id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        toast({
          title: 'Download concluído',
          description: 'O carnê foi baixado com sucesso.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar o carnê',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleViewPdf = async (carne: typeof carnes[0]) => {
    setIsLoadingPdf(true);
    try {
      const booklet = await getInstallmentBooklet(carne.asaas_installment_id);
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
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível visualizar o carnê',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleDeleteClick = (carne: typeof carnes[0]) => {
    setCarneToDelete(carne);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!carneToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete from Asaas
      const success = await deleteInstallment(carneToDelete.asaas_installment_id);
      
      if (success) {
        // Update local status
        await deleteCarne(carneToDelete.id);
        await refetchCarnes();
        
        toast({
          title: 'Carnê excluído',
          description: 'O carnê foi excluído com sucesso.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o carnê',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setCarneToDelete(null);
    }
  };

  const handleReceiveInCash = async (payment: CarnePayment) => {
    if (!selectedCarne) return;
    
    setIsProcessingPayment(payment.id);
    try {
      const success = await receiveInCash(payment.id);
      
      if (success) {
        // Refresh payments list
        await handleViewDetails(selectedCarne);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível dar baixa no boleto',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(null);
    }
  };

  // Get payments due in next 48 hours
  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  
  const paymentsDueIn48h = payments.filter(payment => {
    if (payment.status !== 'PENDING' && payment.status !== 'pending') return false;
    const dueDate = new Date(payment.due_date);
    return dueDate >= now && dueDate <= in48Hours;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carnês de Pagamento</h1>
        <p className="text-muted-foreground">Gerencie os carnês gerados e acompanhe os pagamentos</p>
      </div>

      {/* Payments due in 48h Alert */}
      {paymentsDueIn48h.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Clock className="w-5 h-5" />
              Boletos Vencendo em 48 Horas ({paymentsDueIn48h.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsDueIn48h.map((payment) => {
                    const guardian = getGuardianById(payment.guardian_id);
                    return (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{guardian?.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell className="font-medium">
                          R$ {payment.value.toFixed(2).replace('.', ',')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-warning">
                            <Calendar className="w-3 h-3" />
                            {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(payment.invoice_url || payment.bank_slip_url) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(payment.invoice_url || payment.bank_slip_url || '', '_blank')}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver Boleto
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Carnês</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vence em 48h</p>
                <p className="text-2xl font-bold">{paymentsDueIn48h.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Atraso</p>
                <p className="text-2xl font-bold">{stats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finalizados</p>
                <p className="text-2xl font-bold">{stats.ended}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por responsável, descrição ou ID..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Ativos</SelectItem>
                <SelectItem value="OVERDUE">Em Atraso</SelectItem>
                <SelectItem value="ENDED">Finalizados</SelectItem>
                <SelectItem value="DELETED">Excluídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Carnês Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Lista de Carnês ({filteredCarnes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCarnes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum carnê encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>1º Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCarnes.map((carne) => {
                    const guardian = getGuardianById(carne.guardian_id);
                    return (
                      <TableRow key={carne.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{guardian?.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {carne.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{carne.installment_count}x</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          R$ {carne.total_value.toFixed(2).replace('.', ',')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(carne.first_due_date).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(getCarneRealStatus(carne))}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleViewDetails(carne)}
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleViewPdf(carne)}
                              disabled={isLoadingPdf}
                              title="Visualizar PDF"
                            >
                              {isLoadingPdf ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDownloadPdf(carne)}
                              disabled={isLoadingPdf}
                              title="Baixar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {carne.status === 'ACTIVE' && isAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteClick(carne)}
                                className="text-destructive hover:text-destructive"
                                title="Excluir carnê"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Detalhes do Carnê
            </DialogTitle>
            <DialogDescription>
              Acompanhe as parcelas e o status de cada pagamento
            </DialogDescription>
          </DialogHeader>
          
          {selectedCarne && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {/* Carne Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="font-medium text-sm">{getGuardianById(selectedCarne.guardian_id)?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-medium text-sm">{getGuardianById(selectedCarne.guardian_id)?.cpf || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status do Carnê</p>
                  {getStatusBadge(getCarneRealStatus(selectedCarne))}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID Asaas</p>
                  <p className="font-medium text-xs break-all">{selectedCarne.asaas_installment_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-medium text-sm text-primary">R$ {selectedCarne.total_value.toFixed(2).replace('.', ',')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Parcelas</p>
                  <p className="font-medium text-sm">{selectedCarne.installment_count}x de R$ {(selectedCarne.total_value / selectedCarne.installment_count).toFixed(2).replace('.', ',')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">1º Vencimento</p>
                  <p className="font-medium text-sm">{new Date(selectedCarne.first_due_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="font-medium text-xs">{selectedCarne.description}</p>
                </div>
              </div>

              {/* Payment Summary */}
              {carnePayments.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-success/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-success">
                      {carnePayments.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Pagas</p>
                  </div>
                  <div className="p-3 bg-warning/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-warning">
                      {carnePayments.filter(p => p.status === 'PENDING').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-destructive">
                      {carnePayments.filter(p => p.status === 'OVERDUE').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Vencidas</p>
                  </div>
                </div>
              )}

              {/* Payments Table */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Boletos ({carnePayments.length})
                </h4>
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : carnePayments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum boleto encontrado.
                  </p>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Parcela</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carnePayments.map((payment) => (
                          <TableRow key={payment.id} className={payment.status === 'OVERDUE' ? 'bg-destructive/5' : ''}>
                            <TableCell>
                              <Badge variant="outline">{payment.installmentNumber}ª</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              R$ {payment.value.toFixed(2).replace('.', ',')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
                              </div>
                            </TableCell>
                            <TableCell>
                              {payment.paymentDate 
                                ? new Date(payment.paymentDate).toLocaleDateString('pt-BR')
                                : '-'
                              }
                            </TableCell>
                            <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Baixa manual - only for pending/overdue */}
                                {['PENDING', 'OVERDUE'].includes(payment.status) && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleReceiveInCash(payment)}
                                    disabled={isProcessingPayment === payment.id}
                                    title="Dar baixa manual"
                                    className="text-success hover:text-success"
                                  >
                                    {isProcessingPayment === payment.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Banknote className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                                {payment.invoiceUrl && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => window.open(payment.invoiceUrl, '_blank')}
                                    title="Ver fatura"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                )}
                                {payment.bankSlipUrl && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => window.open(payment.bankSlipUrl, '_blank')}
                                    title="Ver boleto"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Fechar
            </Button>
            {selectedCarne && (
              <Button onClick={() => handleDownloadPdf(selectedCarne)} disabled={isLoadingPdf}>
                {isLoadingPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Baixar Carnê
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Carnê</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este carnê? Esta ação irá cancelar todas as cobranças 
              pendentes no Asaas e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
