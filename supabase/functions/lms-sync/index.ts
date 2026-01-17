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

interface LMSStudentListResponse {
  success: boolean;
  data?: Array<{
    student_user_id: string;
    email: string;
    name: string;
  }>;
  error?: string;
}

const LMS_API_BASE = 'https://icbudgpjptemjfymssvr.supabase.co/functions/v1';
const getLmsApiKey = () => Deno.env.get('LMS_API_KEY') || '';

// Helper function to find student UUID from LMS by search term
async function findStudentUUID(searchTerm: string): Promise<string | null> {
  try {
    console.log('Searching for student UUID by:', searchTerm);
    
    const response = await fetch(`${LMS_API_BASE}/list-students?search=${encodeURIComponent(searchTerm)}&limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getLmsApiKey(),
      },
    });

    console.log('List-students response status:', response.status);
    const responseText = await response.text();
    console.log('List-students response body:', responseText);

    if (response.ok) {
      const result: LMSStudentListResponse = JSON.parse(responseText);
      if (result.success && result.data && result.data.length > 0) {
        console.log('Found student UUID:', result.data[0].student_user_id);
        return result.data[0].student_user_id;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding student UUID:', error);
    return null;
  }
}

// Try multiple search strategies to find student UUID
async function findStudentUUIDWithFallback(email: string, studentName?: string): Promise<string | null> {
  // First try by email
  let uuid = await findStudentUUID(email);
  if (uuid) return uuid;
  
  // Try by student name if available
  if (studentName) {
    console.log('Email search failed, trying by name:', studentName);
    uuid = await findStudentUUID(studentName);
    if (uuid) return uuid;
    
    // Try first name only
    const firstName = studentName.split(' ')[0];
    if (firstName && firstName.length > 2) {
      console.log('Full name search failed, trying first name:', firstName);
      uuid = await findStudentUUID(firstName);
      if (uuid) return uuid;
    }
  }
  
  return null;
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
        .select(`
          *,
          student:students(id, name)
        `)
        .eq('id', credentialId)
        .single();

      if (credError || !credential) {
        console.error('Credential not found:', credError);
        throw new Error('Credential not found');
      }

      // Get the student UUID - first check if we have it, otherwise look it up
      let studentUserId = credential.lms_user_id;
      
      if (!studentUserId) {
        const studentName = credential.student?.name;
        console.log('No lms_user_id found, looking up by email and name:', credential.email, studentName);
        studentUserId = await findStudentUUIDWithFallback(credential.email, studentName);
        
        if (studentUserId) {
          // Save the UUID for future use
          await supabase
            .from('lms_credentials')
            .update({ lms_user_id: studentUserId })
            .eq('id', credentialId);
          console.log('Saved lms_user_id:', studentUserId);
        }
      }

      if (!studentUserId) {
        console.log('Could not find student UUID in LMS');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Student not found in LMS. Please verify the email is correct.',
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

      const lmsApiUrl = `${LMS_API_BASE}/lms-student-progress?student_user_id=${studentUserId}`;
      
      try {
        console.log('Calling LMS API for student UUID:', studentUserId);
        console.log('LMS API URL:', lmsApiUrl);
        
        const lmsResponse = await fetch(lmsApiUrl, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'X-API-Key': getLmsApiKey(),
          },
        });

        console.log('LMS API response status:', lmsResponse.status);
        const responseText = await lmsResponse.text();
        console.log('LMS API response body:', responseText);

        if (lmsResponse.ok) {
          const progressData: LMSProgressResponse = JSON.parse(responseText);
          
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
          } else {
            console.log('LMS API response not successful or no data:', progressData);
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
        .select('id, email, matricula, lms_user_id');

      if (error) {
        throw error;
      }

      console.log(`Syncing ${credentials?.length || 0} credentials`);

      let syncedCount = 0;
      const now = new Date().toISOString();
      
      for (const cred of credentials || []) {
        let studentUserId = cred.lms_user_id;
        
        // If no UUID, look it up by email
        if (!studentUserId && cred.email) {
          studentUserId = await findStudentUUID(cred.email);
          if (studentUserId) {
            await supabase
              .from('lms_credentials')
              .update({ lms_user_id: studentUserId })
              .eq('id', cred.id);
          }
        }
        
        if (!studentUserId) {
          console.log(`Skipping credential ${cred.id}: no UUID found`);
          continue;
        }

        try {
          const lmsResponse = await fetch(`${LMS_API_BASE}/lms-student-progress?student_user_id=${studentUserId}`, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'X-API-Key': getLmsApiKey(),
            },
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
    
    const response = await fetch(`${LMS_API_BASE}/lms-student-progress`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': getLmsApiKey(),
      },
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
