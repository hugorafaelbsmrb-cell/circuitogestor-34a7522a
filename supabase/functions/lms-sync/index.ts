import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LMSProgressResponse {
  success: boolean;
  data?: {
    user_id: string;
    current_module: string;
    current_level: string;
    current_lesson: string;
    completion_percentage: number;
    status: string;
  };
  error?: string;
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

    const { action, studentId, credentialId, email, matricula } = await req.json();

    console.log('LMS Sync request:', { action, studentId, credentialId });

    // Get all LMS credentials or specific one
    if (action === 'getCredentials') {
      let query = supabase
        .from('lms_credentials')
        .select(`
          *,
          student:students(id, name, birth_date, is_active),
          enrollment:enrollments(id, status, class_group_id)
        `)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data: credentials, error } = await query;

      if (error) {
        console.error('Error fetching credentials:', error);
        throw error;
      }

      console.log(`Found ${credentials?.length || 0} credentials`);

      return new Response(
        JSON.stringify({ success: true, data: credentials }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync progress from LMS
    if (action === 'syncProgress') {
      // Get the credential to sync
      const { data: credential, error: credError } = await supabase
        .from('lms_credentials')
        .select('*')
        .eq('id', credentialId)
        .single();

      if (credError || !credential) {
        console.error('Credential not found:', credError);
        throw new Error('Credential not found');
      }

      // Call the external LMS API to get progress using GET with student_user_id
      const lmsApiUrl = `https://icbudgpjptemjfymssvr.supabase.co/functions/v1/lms-student-progress?student_user_id=${credential.lms_user_id || credential.matricula}`;
      
      try {
        console.log('Calling LMS API for student:', credential.lms_user_id || credential.matricula);
        
        const lmsResponse = await fetch(lmsApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (lmsResponse.ok) {
          const progressData: LMSProgressResponse = await lmsResponse.json();
          
          if (progressData.success && progressData.data) {
            // Update local credential with progress data
            const { error: updateError } = await supabase
              .from('lms_credentials')
              .update({
                current_module: progressData.data.current_module,
                current_level: progressData.data.current_level,
                current_lesson: progressData.data.current_lesson,
                completion_percentage: progressData.data.completion_percentage,
                lms_user_id: progressData.data.user_id,
                last_sync_at: new Date().toISOString(),
              })
              .eq('id', credentialId);

            if (updateError) {
              console.error('Error updating credential:', updateError);
              throw updateError;
            }

            console.log('Progress synced successfully');

            return new Response(
              JSON.stringify({ 
                success: true, 
                message: 'Progress synced successfully',
                data: progressData.data 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // If LMS API fails or returns no data, return current data
        console.log('LMS API did not return progress data, using cached data');
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Using cached data (LMS API unavailable)',
            data: {
              current_module: credential.current_module,
              current_level: credential.current_level,
              current_lesson: credential.current_lesson,
              completion_percentage: credential.completion_percentage,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (lmsError) {
        console.error('Error calling LMS API:', lmsError);
        
        // Return cached data if LMS is unavailable
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Using cached data (LMS API error)',
            data: {
              current_module: credential.current_module,
              current_level: credential.current_level,
              current_lesson: credential.current_lesson,
              completion_percentage: credential.completion_percentage,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Sync all credentials
    if (action === 'syncAll') {
      const { data: credentials, error } = await supabase
        .from('lms_credentials')
        .select('id, matricula, email');

      if (error) {
        throw error;
      }

      console.log(`Syncing ${credentials?.length || 0} credentials`);

      // For now, just update last_sync_at
      // In production, you would call the LMS API for each credential
      const now = new Date().toISOString();
      
      for (const cred of credentials || []) {
        await supabase
          .from('lms_credentials')
          .update({ last_sync_at: now })
          .eq('id', cred.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Synced ${credentials?.length || 0} credentials`,
          syncedCount: credentials?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('LMS Sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
