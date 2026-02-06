import { useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import {
  maskCPF,
  maskPhone,
  maskEmail,
  maskAddress,
  maskName,
  maskGuardianData,
  maskGuardiansData,
  maskLeadData,
  maskLeadsData,
  type MaskedGuardian,
  type MaskedLead,
} from '@/utils/dataMasking';

/**
 * Hook para mascaramento de dados sensíveis baseado no role do usuário
 * Admins veem dados completos, outros usuários veem dados mascarados
 */
export function useMaskedData() {
  const { isAdmin, isLoading } = useUserRole();

  /**
   * Determina se deve mostrar dados completos (true para admins)
   */
  const showFullData = isAdmin;

  /**
   * Funções de mascaramento que consideram o role
   */
  const mask = useMemo(() => ({
    cpf: (value: string | null | undefined) => maskCPF(value, showFullData),
    phone: (value: string | null | undefined) => maskPhone(value, showFullData),
    email: (value: string | null | undefined) => maskEmail(value, showFullData),
    address: (value: string | null | undefined) => maskAddress(value, showFullData),
    name: (value: string | null | undefined) => maskName(value, showFullData),
  }), [showFullData]);

  /**
   * Mascara um objeto Guardian
   */
  const maskGuardian = <T extends Partial<MaskedGuardian>>(guardian: T): T => {
    return maskGuardianData(guardian, showFullData);
  };

  /**
   * Mascara um array de Guardians
   */
  const maskGuardians = <T extends Partial<MaskedGuardian>>(guardians: T[]): T[] => {
    return maskGuardiansData(guardians, showFullData);
  };

  /**
   * Mascara um objeto Lead
   */
  const maskLead = <T extends Partial<MaskedLead>>(lead: T): T => {
    return maskLeadData(lead, showFullData);
  };

  /**
   * Mascara um array de Leads
   */
  const maskLeads = <T extends Partial<MaskedLead>>(leads: T[]): T[] => {
    return maskLeadsData(leads, showFullData);
  };

  return {
    isAdmin,
    isLoading,
    showFullData,
    mask,
    maskGuardian,
    maskGuardians,
    maskLead,
    maskLeads,
  };
}

/**
 * Hook simplificado para verificar se deve mascarar dados
 */
export function useShouldMaskData() {
  const { isAdmin, isLoading } = useUserRole();
  
  return {
    shouldMask: !isAdmin,
    isLoading,
  };
}
