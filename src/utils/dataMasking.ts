/**
 * Utilitários para mascaramento de dados sensíveis no frontend
 * Usados para ocultar dados de usuários não-admin no DevTools (F12)
 */

/**
 * Mascara CPF: 123.456.789-00 → ***.***.***.00
 */
export function maskCPF(cpf: string | null | undefined, showFull = false): string {
  if (!cpf) return '***.***.***-**';
  if (showFull) return cpf;
  
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 2) return '***.***.***-**';
  
  return `***.***.***-${digits.slice(-2)}`;
}

/**
 * Mascara telefone: (11) 98765-4321 → (**) *****-4321
 */
export function maskPhone(phone: string | null | undefined, showFull = false): string {
  if (!phone) return '(**) *****-****';
  if (showFull) return phone;
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '(**) *****-****';
  
  return `(**) *****-${digits.slice(-4)}`;
}

/**
 * Mascara email: joao.silva@email.com → j***@email.com
 */
export function maskEmail(email: string | null | undefined, showFull = false): string {
  if (!email) return '***@***.***';
  if (showFull) return email;
  
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  
  const [local, domain] = parts;
  if (!local || local.length === 0) return '***@' + domain;
  
  return `${local.charAt(0)}***@${domain}`;
}

/**
 * Mascara endereço: Rua das Flores, 123 → Rua das Flores, ***
 */
export function maskAddress(address: string | null | undefined, showFull = false): string {
  if (!address) return '***';
  if (showFull) return address;
  
  const firstPart = address.split(',')[0];
  return `${firstPart}, ***`;
}

/**
 * Mascara nome parcialmente: João Silva → J*** S***
 */
export function maskName(name: string | null | undefined, showFull = false): string {
  if (!name) return '***';
  if (showFull) return name;
  
  return name
    .split(' ')
    .map(part => part.length > 0 ? `${part.charAt(0)}***` : '')
    .join(' ');
}

/**
 * Interface para dados mascaráveis de Guardian
 */
export interface MaskedGuardian {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  address: string;
  address_number?: string | null;
  province?: string | null;
  postal_code?: string | null;
  avatar_url?: string | null;
  asaas_customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface para dados mascaráveis de Lead
 */
export interface MaskedLead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  guardian_cpf: string | null;
  guardian_address: string | null;
  guardian_address_number?: string | null;
  guardian_province?: string | null;
  guardian_postal_code?: string | null;
  avatar_url?: string | null;
  source?: string | null;
  status: string;
  notes?: string | null;
  student_name?: string | null;
  student_birth_date?: string | null;
  student_sex?: string | null;
  interested_course_id?: string | null;
  assigned_to?: string | null;
  converted_at?: string | null;
  enrollment_id?: string | null;
  preferred_due_day?: number | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Aplica mascaramento a um objeto Guardian
 */
export function maskGuardianData<T extends Partial<MaskedGuardian>>(
  guardian: T,
  isAdmin: boolean
): T {
  if (isAdmin) return guardian;
  
  return {
    ...guardian,
    cpf: maskCPF(guardian.cpf),
    email: maskEmail(guardian.email),
    phone: maskPhone(guardian.phone),
    address: maskAddress(guardian.address),
  };
}

/**
 * Aplica mascaramento a um array de Guardians
 */
export function maskGuardiansData<T extends Partial<MaskedGuardian>>(
  guardians: T[],
  isAdmin: boolean
): T[] {
  if (isAdmin) return guardians;
  return guardians.map(g => maskGuardianData(g, isAdmin));
}

/**
 * Aplica mascaramento a um objeto Lead
 */
export function maskLeadData<T extends Partial<MaskedLead>>(
  lead: T,
  isAdmin: boolean
): T {
  if (isAdmin) return lead;
  
  return {
    ...lead,
    email: maskEmail(lead.email),
    phone: maskPhone(lead.phone),
    guardian_cpf: maskCPF(lead.guardian_cpf),
    guardian_address: maskAddress(lead.guardian_address),
  };
}

/**
 * Aplica mascaramento a um array de Leads
 */
export function maskLeadsData<T extends Partial<MaskedLead>>(
  leads: T[],
  isAdmin: boolean
): T[] {
  if (isAdmin) return leads;
  return leads.map(l => maskLeadData(l, isAdmin));
}
