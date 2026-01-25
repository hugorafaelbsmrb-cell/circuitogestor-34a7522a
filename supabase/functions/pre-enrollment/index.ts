import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreEnrollmentData {
  // Guardian data
  guardian_name: string;
  guardian_cpf: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address: string;
  guardian_address_number?: string;
  guardian_province?: string;
  guardian_postal_code?: string;
  
  // Student data
  student_name: string;
  student_birth_date: string;
  student_sex?: string;
  
  // Interest
  interested_course_id?: string;
  notes?: string;
}

// Simple CPF validation
function isValidCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[10])) return false;
  
  return true;
}

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Normalize phone to W-API format
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const data: PreEnrollmentData = await req.json();

    // Validate required fields
    if (!data.guardian_name || !data.guardian_cpf || !data.guardian_phone || !data.student_name || !data.student_birth_date) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios não preenchidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CPF
    if (!isValidCPF(data.guardian_cpf)) {
      return new Response(
        JSON.stringify({ error: 'CPF inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    if (data.guardian_email && !isValidEmail(data.guardian_email)) {
      return new Response(
        JSON.stringify({ error: 'E-mail inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize phone
    const normalizedPhone = normalizePhone(data.guardian_phone);

    // Create lead record
    const leadData = {
      name: data.guardian_name,
      email: data.guardian_email || null,
      phone: normalizedPhone,
      source: 'external_form',
      status: 'pre_enrollment',
      notes: data.notes || null,
      student_name: data.student_name,
      student_birth_date: data.student_birth_date,
      student_sex: data.student_sex || 'M',
      interested_course_id: data.interested_course_id || null,
      guardian_cpf: data.guardian_cpf.replace(/\D/g, ''),
      guardian_address: data.guardian_address || null,
      guardian_address_number: data.guardian_address_number || 'S/N',
      guardian_province: data.guardian_province || 'Centro',
      guardian_postal_code: data.guardian_postal_code?.replace(/\D/g, '') || null,
    };

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar pré-matrícula' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pre-enrollment created:', lead.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pré-matrícula enviada com sucesso!',
        leadId: lead.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing pre-enrollment:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
