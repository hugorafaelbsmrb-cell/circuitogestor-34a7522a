import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AsaasCustomer, AsaasPayment, AsaasBoleto, AsaasInstallment } from '@/types/school';

interface CreateCustomerData {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
}


interface CreateCarneData {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
  installmentCount: number;
  interest?: { value: number };
  fine?: { value: number };
}

export function useAsaasPayment() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const callAsaasFunction = async <T>(action: string, data: T) => {
    const { data: result, error } = await supabase.functions.invoke('asaas-payment', {
      body: { action, data },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (result?.error) {
      throw new Error(result.error);
    }

    return result;
  };

  const createCustomer = async (data: CreateCustomerData): Promise<AsaasCustomer | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('createCustomer', data);
      toast({
        title: 'Cliente cadastrado',
        description: 'Cliente cadastrado com sucesso no sistema de pagamentos.',
      });
      return result as AsaasCustomer;
    } catch (error) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };


  const createCarne = async (data: CreateCarneData): Promise<AsaasPayment | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('createCarne', {
        customerId: data.customerId,
        value: data.value,
        installmentCount: data.installmentCount,
        dueDate: data.dueDate,
        description: data.description,
        externalReference: data.externalReference,
        interest: data.interest,
        fine: data.fine,
      });
      toast({
        title: 'Carnê criado',
        description: `Carnê com ${data.installmentCount} parcelas criado com sucesso.`,
      });
      return result as AsaasPayment;
    } catch (error) {
      toast({
        title: 'Erro ao criar carnê',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };


  const listPayments = async (customerId: string): Promise<AsaasPayment[]> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('listPayments', { customerId });
      return (result?.data || []) as AsaasPayment[];
    } catch (error) {
      toast({
        title: 'Erro ao listar pagamentos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const listInstallmentPayments = async (installmentId: string): Promise<AsaasPayment[]> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('listInstallmentPayments', { installmentId });
      return (result?.data || []) as AsaasPayment[];
    } catch (error) {
      toast({
        title: 'Erro ao listar parcelas do carnê',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getInstallment = async (installmentId: string): Promise<AsaasInstallment | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('getInstallment', { installmentId });
      return result as AsaasInstallment;
    } catch (error) {
      toast({
        title: 'Erro ao obter carnê',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteInstallment = async (installmentId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await callAsaasFunction('deleteInstallment', { installmentId });
      toast({
        title: 'Carnê excluído',
        description: 'O carnê foi excluído com sucesso.',
      });
      return true;
    } catch (error) {
      toast({
        title: 'Erro ao excluir carnê',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refundInstallment = async (installmentId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await callAsaasFunction('refundInstallment', { installmentId });
      toast({
        title: 'Carnê estornado',
        description: 'O carnê foi estornado com sucesso.',
      });
      return true;
    } catch (error) {
      toast({
        title: 'Erro ao estornar carnê',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getInstallmentBooklet = async (installmentId: string): Promise<{ pdfBase64: string; contentType: string } | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('getInstallmentBooklet', { installmentId });
      return result as { pdfBase64: string; contentType: string };
    } catch (error) {
      toast({
        title: 'Erro ao obter carnê PDF',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const receiveInCash = async (paymentId: string, paymentDate?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await callAsaasFunction('receiveInCash', { 
        paymentId, 
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        notifyCustomer: false,
      });
      toast({
        title: 'Baixa realizada',
        description: 'O pagamento foi registrado como recebido em dinheiro.',
      });
      return true;
    } catch (error) {
      toast({
        title: 'Erro ao dar baixa',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    createCustomer,
    createCarne,
    listPayments,
    listInstallmentPayments,
    getInstallment,
    deleteInstallment,
    refundInstallment,
    getInstallmentBooklet,
    receiveInCash,
  };
}
