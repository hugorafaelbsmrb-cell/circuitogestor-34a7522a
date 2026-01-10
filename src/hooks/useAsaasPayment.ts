import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AsaasCustomer, AsaasPayment, AsaasBoleto } from '@/types/school';

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

interface CreatePaymentData {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
  installmentCount?: number;
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

  const createPayment = async (data: CreatePaymentData): Promise<AsaasPayment | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('createPayment', {
        customerId: data.customerId,
        billingType: 'BOLETO',
        value: data.value,
        dueDate: data.dueDate,
        description: data.description,
        externalReference: data.externalReference,
      });
      toast({
        title: 'Boleto gerado',
        description: 'O boleto foi gerado com sucesso.',
      });
      return result as AsaasPayment;
    } catch (error) {
      toast({
        title: 'Erro ao gerar boleto',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const createInstallments = async (data: CreatePaymentData): Promise<AsaasPayment | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('createInstallments', {
        customerId: data.customerId,
        value: data.value,
        installmentCount: data.installmentCount || 1,
        dueDate: data.dueDate,
        description: data.description,
        externalReference: data.externalReference,
      });
      toast({
        title: 'Parcelamento criado',
        description: `Parcelamento em ${data.installmentCount}x criado com sucesso.`,
      });
      return result as AsaasPayment;
    } catch (error) {
      toast({
        title: 'Erro ao criar parcelamento',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getBoleto = async (paymentId: string): Promise<AsaasBoleto | null> => {
    setIsLoading(true);
    try {
      const result = await callAsaasFunction('getBoleto', { paymentId });
      return result as AsaasBoleto;
    } catch (error) {
      toast({
        title: 'Erro ao obter boleto',
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

  return {
    isLoading,
    createCustomer,
    createPayment,
    createInstallments,
    getBoleto,
    listPayments,
  };
}
