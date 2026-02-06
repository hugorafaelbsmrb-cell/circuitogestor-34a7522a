import { useState } from 'react';
import { Loader2, Receipt, User, Calendar, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

interface Guardian {
  id: string;
  name: string;
  cpf: string;
  asaas_customer_id: string | null;
}

interface CreateBoletoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guardians: Guardian[];
  onSuccess: () => void;
}

export function CreateBoletoModal({ open, onOpenChange, guardians, onSuccess }: CreateBoletoModalProps) {
  const { createBoleto, createCustomer, isLoading } = useAsaasPayment();
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 5), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedGuardian = guardians.find(g => g.id === selectedGuardianId);

  const formatCurrency = (val: string) => {
    const num = val.replace(/\D/g, '');
    const formatted = (parseInt(num) / 100).toFixed(2);
    return formatted === 'NaN' ? '' : formatted;
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw) {
      const numValue = parseInt(raw) / 100;
      setValue(numValue.toFixed(2));
    } else {
      setValue('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedGuardian) {
      toast.error('Selecione um responsável');
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!dueDate) {
      toast.error('Informe a data de vencimento');
      return;
    }

    if (!description.trim()) {
      toast.error('Informe uma descrição');
      return;
    }

    setIsSubmitting(true);

    try {
      let asaasCustomerId = selectedGuardian.asaas_customer_id;

      // If guardian doesn't have asaas_customer_id, create customer first
      if (!asaasCustomerId) {
        const { data: guardianData } = await supabase
          .from('guardians')
          .select('*')
          .eq('id', selectedGuardianId)
          .single();

        if (!guardianData) {
          throw new Error('Dados do responsável não encontrados');
        }

        const customer = await createCustomer({
          name: guardianData.name,
          cpfCnpj: guardianData.cpf,
          email: guardianData.email,
          phone: guardianData.phone,
          address: guardianData.address,
          addressNumber: guardianData.address_number || 'S/N',
          province: guardianData.province || 'Centro',
          postalCode: guardianData.postal_code || '00000000',
        });

        if (!customer) {
          throw new Error('Erro ao criar cliente no Asaas');
        }

        asaasCustomerId = customer.id;

        // Update guardian with asaas_customer_id
        await supabase
          .from('guardians')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('id', selectedGuardianId);
      }

      // Create boleto in Asaas
      const boletoResult = await createBoleto({
        customerId: asaasCustomerId,
        value: numValue,
        dueDate: dueDate,
        description: description.trim(),
        externalReference: `avulso-${selectedGuardianId}-${Date.now()}`,
      });

      if (!boletoResult) {
        throw new Error('Erro ao criar boleto no Asaas');
      }

      // Save payment in local database
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          guardian_id: selectedGuardianId,
          description: description.trim(),
          value: numValue,
          due_date: dueDate,
          status: 'PENDING',
          asaas_payment_id: boletoResult.id,
          invoice_url: boletoResult.invoiceUrl,
          bank_slip_url: boletoResult.bankSlipUrl,
          billing_type: 'BOLETO',
        });

      if (paymentError) {
        console.error('Error saving payment:', paymentError);
        // Don't throw - boleto was created in Asaas successfully
        toast.warning('Boleto criado no Asaas, mas houve erro ao salvar localmente');
      }

      toast.success('Boleto avulso criado com sucesso!');
      
      // Reset form
      setSelectedGuardianId('');
      setValue('');
      setDueDate(format(addDays(new Date(), 5), 'yyyy-MM-dd'));
      setDescription('');
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating boleto:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar boleto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Emitir Boleto Avulso
          </DialogTitle>
          <DialogDescription>
            Crie um boleto de cobrança avulso para um responsável cadastrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Guardian Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Responsável
            </Label>
            <Select value={selectedGuardianId} onValueChange={setSelectedGuardianId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {guardians.map(guardian => (
                  <SelectItem key={guardian.id} value={guardian.id}>
                    <div className="flex flex-col">
                      <span>{guardian.name}</span>
                      <span className="text-xs text-muted-foreground">{guardian.cpf}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                type="text"
                placeholder="0,00"
                value={value ? parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={handleValueChange}
                className="pl-10"
              />
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data de Vencimento
            </Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descrição
            </Label>
            <Textarea
              placeholder="Ex: Mensalidade Abril/2024, Material Didático, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoading}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4 mr-2" />
                Criar Boleto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}