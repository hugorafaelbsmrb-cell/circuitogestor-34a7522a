import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface SorobanStudentPayload {
  matricula: string;
  nome: string;
  data_nascimento: string;
  email?: string;
  nivel?: number;
}

function generatePassword(name: string, birthDate: string): string {
  // Get first 3 letters of the first name (lowercase)
  const firstName = name.split(' ')[0].toLowerCase();
  const firstThree = firstName.substring(0, 3);
  
  // Get year from birth date (format: YYYY-MM-DD)
  const year = birthDate.split('-')[0];
  
  return `${firstThree}${year}`;
}

function generateStudentEmail(fullName: string): string {
  // Normalize and remove accents
  const normalized = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  const nameParts = normalized.split(' ').filter(part => part.length > 0);
  
  if (nameParts.length === 0) {
    return `aluno@circuitokids.com.br`;
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  
  // Generate email: firstname.lastname@circuitokids.com.br
  const email = lastName 
    ? `${firstName}.${lastName}@circuitokids.com.br`
    : `${firstName}@circuitokids.com.br`;
  
  return email;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate webhook secret (optional but recommended)
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('SOROBAN_WEBHOOK_SECRET');
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const payload = await req.json();
    console.log('Soroban Webhook received:', JSON.stringify(payload));

    // Handle both single student and array of students
    const students: SorobanStudentPayload[] = Array.isArray(payload) ? payload : [payload];
    const results: any[] = [];

    for (const student of students) {
      try {
        const { matricula, nome, data_nascimento, nivel } = student;

        if (!matricula || !nome || !data_nascimento) {
          results.push({
            matricula,
            success: false,
            error: 'Missing required fields: matricula, nome, data_nascimento',
          });
          continue;
        }

        // Check if student already exists with this matricula
        const { data: existingCred } = await supabase
          .from('soroban_credentials')
          .select('*')
          .eq('matricula', matricula)
          .maybeSingle();

        if (existingCred) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('soroban_credentials')
            .update({
              current_level: nivel || existingCred.current_level,
              updated_at: new Date().toISOString(),
            })
            .eq('matricula', matricula);

          if (updateError) {
            console.error('Error updating soroban credentials:', updateError);
            results.push({
              matricula,
              success: false,
              error: updateError.message,
            });
          } else {
            results.push({
              matricula,
              success: true,
              message: 'Student updated',
              credentials: {
                email: existingCred.email,
                password: existingCred.password,
                matricula: existingCred.matricula,
              },
            });
          }
          continue;
        }

        // Generate credentials
        const generatedEmail = generateStudentEmail(nome);
        const generatedPassword = generatePassword(nome, data_nascimento);

        console.log('Generated Soroban credentials:', { 
          matricula, 
          email: generatedEmail, 
          password: generatedPassword 
        });

        // Try to find matching student in our database by name (optional linkage)
        const { data: matchingStudent } = await supabase
          .from('students')
          .select('id')
          .ilike('name', `%${nome.split(' ')[0]}%`)
          .maybeSingle();

        // Save credentials
        const { error: insertError } = await supabase
          .from('soroban_credentials')
          .insert({
            matricula,
            email: generatedEmail,
            password: generatedPassword,
            current_level: nivel || 1,
            student_id: matchingStudent?.id || null,
          });

        if (insertError) {
          console.error('Error saving soroban credentials:', insertError);
          results.push({
            matricula,
            success: false,
            error: insertError.message,
          });
        } else {
          results.push({
            matricula,
            success: true,
            message: 'Student created',
            credentials: {
              email: generatedEmail,
              password: generatedPassword,
              matricula,
            },
          });
        }
      } catch (studentError) {
        console.error('Error processing student:', studentError);
        results.push({
          matricula: student.matricula,
          success: false,
          error: studentError instanceof Error ? studentError.message : 'Unknown error',
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    
    return new Response(
      JSON.stringify({ 
        success: allSuccess,
        results,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allSuccess ? 200 : 207, // 207 Multi-Status if partial success
      }
    );

  } catch (error) {
    console.error('Soroban webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
