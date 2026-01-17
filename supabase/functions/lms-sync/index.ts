import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LMSProgressResponse {
  success: boolean;
  data?: {
    user_id: string;
    status: string;
    current_module: string;
    current_level: string;
    current_lesson: string;
    completion_percentage: number;
    total_lessons: number;
    completed_lessons: number;
    total_xp: number;
    coins: number;
  };
  error?: string;
}

const LMS_API_BASE = 'https://icbudgpjptemjfymssvr.supabase.co/functions/v1/lms-student-progress';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    const { action, studentId, credentialId } = requestBody;

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

    // Sync progress from LMS (GET endpoint)
    if (action === 'syncProgress') {
      const { data: credential, error: credError } = await supabase
        .from('lms_credentials')
        .select('*')
        .eq('id', credentialId)
        .single();

      if (credError || !credential) {
        console.error('Credential not found:', credError);
        throw new Error('Credential not found');
      }

      const studentUserId = credential.lms_user_id || credential.matricula;
      const lmsApiUrl = `${LMS_API_BASE}?student_user_id=${studentUserId}`;
      
      try {
        console.log('Calling LMS API for student:', studentUserId);
        
        const lmsResponse = await fetch(lmsApiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (lmsResponse.ok) {
          const progressData: LMSProgressResponse = await lmsResponse.json();
          
          if (progressData.success && progressData.data) {
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

    // LMS Management Actions (POST to external LMS)
    if (action === 'unlockLevel') {
      const { lmsUserId, levelId } = requestBody;
      return await callLMSAction('unlock_level', { student_user_id: lmsUserId, level_id: levelId });
    }

    if (action === 'updateLessonStatus') {
      const { lmsUserId, lessonId, status } = requestBody;
      return await callLMSAction('update_lesson_status', { student_user_id: lmsUserId, lesson_id: lessonId, status });
    }

    if (action === 'resetProgress') {
      const { lmsUserId } = requestBody;
      return await callLMSAction('reset_progress', { student_user_id: lmsUserId });
    }

    if (action === 'setModule') {
      const { lmsUserId, moduleId } = requestBody;
      return await callLMSAction('set_module', { student_user_id: lmsUserId, module_id: moduleId });
    }

    if (action === 'setLevel') {
      const { lmsUserId, levelId } = requestBody;
      return await callLMSAction('set_level', { student_user_id: lmsUserId, level_id: levelId });
    }

    // Sync all credentials
    if (action === 'syncAll') {
      const { data: credentials, error } = await supabase
        .from('lms_credentials')
        .select('id, matricula, lms_user_id');

      if (error) {
        throw error;
      }

      console.log(`Syncing ${credentials?.length || 0} credentials`);

      let syncedCount = 0;
      const now = new Date().toISOString();
      
      for (const cred of credentials || []) {
        const studentUserId = cred.lms_user_id || cred.matricula;
        try {
          const lmsResponse = await fetch(`${LMS_API_BASE}?student_user_id=${studentUserId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });

          if (lmsResponse.ok) {
            const progressData: LMSProgressResponse = await lmsResponse.json();
            
            if (progressData.success && progressData.data) {
              await supabase
                .from('lms_credentials')
                .update({
                  current_module: progressData.data.current_module,
                  current_level: progressData.data.current_level,
                  current_lesson: progressData.data.current_lesson,
                  completion_percentage: progressData.data.completion_percentage,
                  lms_user_id: progressData.data.user_id,
                  last_sync_at: now,
                })
                .eq('id', cred.id);
              
              syncedCount++;
            }
          }
        } catch (err) {
          console.error(`Error syncing credential ${cred.id}:`, err);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Synced ${syncedCount} of ${credentials?.length || 0} credentials`,
          syncedCount,
          totalCount: credentials?.length || 0
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

// Helper function to call LMS management actions
async function callLMSAction(actionType: string, params: Record<string, string>) {
  try {
    console.log(`Calling LMS action: ${actionType}`, params);
    
    const response = await fetch(LMS_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionType, ...params }),
    });

    const result = await response.json();
    
    return new Response(
      JSON.stringify({ 
        success: response.ok && result.success, 
        message: result.message || (response.ok ? 'Action completed' : 'Action failed'),
        data: result.data
      }),
      { 
        status: response.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error(`Error calling LMS action ${actionType}:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'LMS API error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}