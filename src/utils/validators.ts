/**
 * Validates a Brazilian CPF number
 * @param cpf - CPF string (can include formatting)
 * @returns true if valid, false otherwise
 */
export function isValidCPF(cpf: string): boolean {
  // Remove non-numeric characters
  const cleanCPF = cpf.replace(/\D/g, '');

  // CPF must have exactly 11 digits
  if (cleanCPF.length !== 11) {
    return false;
  }

  // Check for known invalid patterns (all same digits)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCPF.charAt(9))) {
    return false;
  }

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCPF.charAt(10))) {
    return false;
  }

  return true;
}

/**
 * Validates an email address format
 * @param email - Email string
 * @returns true if valid format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.trim() === '') {
    return false;
  }
  
  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email.trim());
}

/**
 * Formats a CPF string with mask (000.000.000-00)
 * @param value - Raw CPF string
 * @returns Formatted CPF string
 */
export function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

/**
 * Formats a phone number string with mask for display
 * @param value - Raw phone string
 * @returns Formatted phone string
 */
export function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}

/**
 * Normalizes a phone number to W-API standard format (551199999999)
 * Always includes country code 55, removes all non-numeric characters
 * @param value - Raw phone string (any format)
 * @returns Normalized phone string in format 551199999999
 */
export function normalizePhoneToWAPI(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  
  // If already has country code 55 and valid length (12-13 digits)
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  
  // If it's a local number (10-11 digits), add country code
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  
  // For other cases, just return digits (might be partial input)
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/**
 * Formats a normalized phone (551199999999) to display format
 * @param value - Normalized phone string
 * @returns Formatted phone string for display
 */
export function formatPhoneFromNormalized(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  // Remove country code for display if present
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;
  
  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  } else if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }
  
  return formatPhone(localDigits);
}

/**
 * Formats a CEP string with mask (00000-000)
 * @param value - Raw CEP string
 * @returns Formatted CEP string
 */
export function formatCEP(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  return cleaned.replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
}
