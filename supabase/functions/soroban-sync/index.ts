import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENROLLMENT_WEBHOOK_URL = 'https://jnpiohfanzdedpbvafuk.supabase.co/functions/v1/enrollment-webhook';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key for Soroban
    const apiKey = Deno.env.get('SOROBAN_WEBHOOK_SECRET') || 'educacionalcircuuiToKIdsLTDA';

    const { action, credentialId, studentId, matricula } = await req.json();
    console.log('Soroban Sync request:', { action, credentialId, studentId, matricula });

    if (action === 'syncAll') {
      // Fetch all Soroban credentials with student and enrollment data
      const { data: credentials, error: fetchError } = await supabase
        .from('soroban_credentials')
        .select(`
          *,
          student:students(id, name, birth_date, guardian_id),
          enrollment:enrollments(id, class_group_id)
        `);

      if (fetchError) {
        throw new Error(`Failed to fetch credentials: ${fetchError.message}`);
      }

      const results: any[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const cred of credentials || []) {
        try {
          // Send student data to enrollment webhook
          const studentData = {
            event: 'soroban_sync',
            matricula: cred.matricula,
            email: cred.email,
            password: cred.password,
            student_name: cred.student?.name,
            student_birth_date: cred.student?.birth_date,
            student_id: cred.student_id,
            enrollment_id: cred.enrollment_id,
            current_level: cred.current_level,
            current_module: cred.current_module,
            completion_percentage: cred.completion_percentage,
          };

          const response = await fetch(ENROLLMENT_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': apiKey,
            },
            body: JSON.stringify(studentData),
          });

          if (response.ok) {
            // Update last_sync_at
            await supabase
              .from('soroban_credentials')
              .update({ last_sync_at: new Date().toISOString() })
              .eq('id', cred.id);

            successCount++;
            results.push({ matricula: cred.matricula, success: true });
          } else {
            const errorText = await response.text();
            console.log(`Webhook returned ${response.status} for ${cred.matricula}: ${errorText}`);
            errorCount++;
            results.push({ matricula: cred.matricula, success: false, error: `HTTP ${response.status}` });
          }
        } catch (studentError) {
          console.error(`Error syncing ${cred.matricula}:`, studentError);
          errorCount++;
          results.push({ 
            matricula: cred.matricula, 
            success: false, 
            error: studentError instanceof Error ? studentError.message : 'Unknown error' 
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sincronização concluída: ${successCount} sucesso, ${errorCount} erros`,
          total: credentials?.length || 0,
          successCount,
          errorCount,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'syncOne') {
      // Sync a single student
      let credential;
      
      if (credentialId) {
        const { data } = await supabase
          .from('soroban_credentials')
          .select('*, student:students(id, name, birth_date)')
          .eq('id', credentialId)
          .maybeSingle();
        credential = data;
      } else if (matricula) {
        const { data } = await supabase
          .from('soroban_credentials')
          .select('*, student:students(id, name, birth_date)')
          .eq('matricula', matricula)
          .maybeSingle();
        credential = data;
      }

      if (!credential) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credential not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Send to enrollment webhook
      const studentData = {
        event: 'soroban_sync',
        matricula: credential.matricula,
        email: credential.email,
        password: credential.password,
        student_name: credential.student?.name,
        student_birth_date: credential.student?.birth_date,
        student_id: credential.student_id,
        enrollment_id: credential.enrollment_id,
        current_level: credential.current_level,
        current_module: credential.current_module,
        completion_percentage: credential.completion_percentage,
      };

      const response = await fetch(ENROLLMENT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': apiKey,
        },
        body: JSON.stringify(studentData),
      });

      if (response.ok) {
        await supabase
          .from('soroban_credentials')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', credential.id);

        return new Response(
          JSON.stringify({ success: true, message: 'Aluno sincronizado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ success: false, error: `Webhook error: ${response.status}`, details: errorText }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use: syncAll, syncOne, pushToExternal' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Soroban sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
