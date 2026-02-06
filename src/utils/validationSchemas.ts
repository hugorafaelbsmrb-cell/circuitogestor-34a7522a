import { z } from 'zod';
import { isValidCPF, isValidEmail } from './validators';

// Common field schemas
export const cpfSchema = z.string()
  .min(11, 'CPF deve ter 11 dígitos')
  .refine((val) => isValidCPF(val), { message: 'CPF inválido' });

export const emailSchema = z.string()
  .min(1, 'Email é obrigatório')
  .refine((val) => isValidEmail(val), { message: 'Email inválido' });

export const phoneSchema = z.string()
  .min(10, 'Telefone deve ter pelo menos 10 dígitos')
  .max(15, 'Telefone deve ter no máximo 15 dígitos')
  .regex(/^[\d\s\-()]+$/, 'Formato de telefone inválido');

export const cepSchema = z.string()
  .min(8, 'CEP deve ter 8 dígitos')
  .max(9, 'CEP inválido')
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido');

export const nameSchema = z.string()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .trim();

export const addressSchema = z.string()
  .min(5, 'Endereço deve ter pelo menos 5 caracteres')
  .max(200, 'Endereço deve ter no máximo 200 caracteres')
  .trim();

// Guardian schema
export const guardianSchema = z.object({
  name: nameSchema,
  cpf: cpfSchema,
  email: emailSchema,
  phone: phoneSchema,
  address: addressSchema,
  address_number: z.string().max(10, 'Número inválido').optional(),
  province: z.string().max(50, 'Bairro inválido').optional(),
  postal_code: cepSchema.optional(),
});

// Student schema
export const studentSchema = z.object({
  name: nameSchema,
  birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
  sex: z.enum(['M', 'F'], { required_error: 'Sexo é obrigatório' }),
});

// Lead schema
export const leadSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  student_name: nameSchema.optional().or(z.literal('')),
  student_birth_date: z.string().optional(),
  interested_course_id: z.string().uuid().optional(),
  notes: z.string().max(500, 'Notas devem ter no máximo 500 caracteres').optional(),
  source: z.string().optional(),
  guardian_cpf: cpfSchema.optional().or(z.literal('')),
  guardian_address: addressSchema.optional().or(z.literal('')),
  guardian_address_number: z.string().max(10).optional(),
  guardian_province: z.string().max(50).optional(),
  guardian_postal_code: cepSchema.optional().or(z.literal('')),
});

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

// User creation schema
export const userSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  full_name: nameSchema,
  role: z.enum(['admin', 'user', 'moderator']).optional(),
});

// Course schema
export const courseSchema = z.object({
  name: z.string().min(2, 'Nome do curso é obrigatório').max(100),
  description: z.string().max(500).optional(),
  duration: z.string().min(1, 'Duração é obrigatória'),
  price: z.number().min(0, 'Preço deve ser positivo'),
  contract_duration_months: z.number().min(1).max(36).optional(),
});

// Discount schema
export const discountSchema = z.object({
  name: z.string().min(2, 'Nome do desconto é obrigatório').max(100),
  description: z.string().max(200).optional(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Valor deve ser positivo'),
});

// Product schema (canteen)
export const productSchema = z.object({
  name: z.string().min(2, 'Nome do produto é obrigatório').max(100),
  price: z.number().min(0.01, 'Preço deve ser maior que zero'),
  category: z.string().min(1, 'Categoria é obrigatória'),
});

// Teacher schema
export const teacherSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  course_id: z.string().uuid().optional(),
  class_group_id: z.string().uuid().optional(),
});

// Bulk message schema
export const bulkMessageSchema = z.object({
  message: z.string()
    .min(1, 'Mensagem é obrigatória')
    .max(1000, 'Mensagem deve ter no máximo 1000 caracteres'),
  recipients: z.array(z.string()).min(1, 'Selecione pelo menos um destinatário'),
});

// WhatsApp message schema
export const whatsappMessageSchema = z.object({
  phone: phoneSchema,
  message: z.string()
    .min(1, 'Mensagem é obrigatória')
    .max(4096, 'Mensagem muito longa'),
});

// Contract clause schema
export const contractClauseSchema = z.object({
  title: z.string().min(3, 'Título é obrigatório').max(100),
  content: z.string().min(10, 'Conteúdo é obrigatório').max(5000),
  clause_order: z.number().min(1),
});

// Campaign settings schema
export const campaignSettingsSchema = z.object({
  hero_title: z.string().max(100).optional(),
  hero_subtitle: z.string().max(200).optional(),
  urgency_banner_message: z.string().max(150).optional(),
  floating_cta_text: z.string().max(50).optional(),
});

// Schedule schema
export const scheduleSchema = z.object({
  day_of_week: z.string().min(1, 'Dia da semana é obrigatório'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
  available_slots: z.number().min(1).max(50).optional(),
});

// Helper function to validate and get errors
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}

// Helper to format Zod errors for toast
export function formatZodErrors(errors: Record<string, string>): string {
  return Object.values(errors).slice(0, 3).join(', ');
}
