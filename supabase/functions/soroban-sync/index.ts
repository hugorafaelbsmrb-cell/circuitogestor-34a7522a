import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOROBAN_API_URL = 'https://soroban.circuitokids.com.br/api';

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
      // Fetch all Soroban credentials
      const { data: credentials, error: fetchError } = await supabase
        .from('soroban_credentials')
        .select('*, student:students(id, name, birth_date)');

      if (fetchError) {
        throw new Error(`Failed to fetch credentials: ${fetchError.message}`);
      }

      const results: any[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const cred of credentials || []) {
        try {
          // Call external Soroban API to get student progress
          const response = await fetch(`${SOROBAN_API_URL}/student/progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({
              matricula: cred.matricula,
              email: cred.email,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            
            // Update local record with external data
            const { error: updateError } = await supabase
              .from('soroban_credentials')
              .update({
                current_level: data.level || cred.current_level,
                current_module: data.module || cred.current_module,
                completion_percentage: data.completion_percentage || cred.completion_percentage,
                soroban_user_id: data.user_id || cred.soroban_user_id,
                last_sync_at: new Date().toISOString(),
              })
              .eq('id', cred.id);

            if (updateError) {
              console.error(`Error updating ${cred.matricula}:`, updateError);
              errorCount++;
              results.push({ matricula: cred.matricula, success: false, error: updateError.message });
            } else {
              successCount++;
              results.push({ matricula: cred.matricula, success: true, level: data.level });
            }
          } else {
            // API call failed, but we'll continue with other students
            const errorText = await response.text();
            console.log(`Soroban API returned ${response.status} for ${cred.matricula}: ${errorText}`);
            
            // Update last_sync_at anyway to track sync attempts
            await supabase
              .from('soroban_credentials')
              .update({ last_sync_at: new Date().toISOString() })
              .eq('id', cred.id);
            
            results.push({ matricula: cred.matricula, success: false, error: `API ${response.status}` });
            errorCount++;
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
          .select('*')
          .eq('id', credentialId)
          .maybeSingle();
        credential = data;
      } else if (matricula) {
        const { data } = await supabase
          .from('soroban_credentials')
          .select('*')
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

      // Call external Soroban API
      const response = await fetch(`${SOROBAN_API_URL}/student/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          matricula: credential.matricula,
          email: credential.email,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        const { error: updateError } = await supabase
          .from('soroban_credentials')
          .update({
            current_level: data.level || credential.current_level,
            current_module: data.module || credential.current_module,
            completion_percentage: data.completion_percentage || credential.completion_percentage,
            soroban_user_id: data.user_id || credential.soroban_user_id,
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', credential.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Aluno sincronizado', data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ success: false, error: `API error: ${response.status}`, details: errorText }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
        );
      }
    }

    if (action === 'pushToExternal') {
      // Push local data to external Soroban system
      const { data: credentials, error: fetchError } = await supabase
        .from('soroban_credentials')
        .select('*, student:students(id, name, birth_date)');

      if (fetchError) {
        throw new Error(`Failed to fetch credentials: ${fetchError.message}`);
      }

      const studentsToSync = (credentials || []).map(cred => ({
        matricula: cred.matricula,
        nome: cred.student?.name || 'Aluno',
        data_nascimento: cred.student?.birth_date || '2000-01-01',
        email: cred.email,
        nivel: cred.current_level || 1,
      }));

      // Send to external system
      const response = await fetch(`${SOROBAN_API_URL}/students/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(studentsToSync),
      });

      const responseData = await response.json();

      return new Response(
        JSON.stringify({
          success: response.ok,
          message: response.ok ? 'Dados enviados ao sistema externo' : 'Erro ao enviar dados',
          details: responseData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
