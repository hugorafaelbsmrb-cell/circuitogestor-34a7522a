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
async function findStudentUUIDWithFallback(matricula: string, email?: string, studentName?: string): Promise<string | null> {
  // First try by matricula
  console.log('Trying search by matricula:', matricula);
  let uuid = await findStudentUUID(matricula);
  if (uuid) return uuid;
  
  // Try by email if available
  if (email) {
    console.log('Matricula search failed, trying by email:', email);
    uuid = await findStudentUUID(email);
    if (uuid) return uuid;
  }
  
  // Try by student name if available
  if (studentName) {
    console.log('Email search failed, trying by name:', studentName);
    uuid = await findStudentUUID(studentName);
    if (uuid) return uuid;
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
          enrollment:enrollments(id, status, class_group_id, enrollment_date, class_group:class_groups(schedule:schedules(day_of_week)))
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

      // For each credential, fetch ALL enrollments for the student to get all class days
      const enrichedCredentials = await Promise.all(
        (credentials || []).map(async (cred) => {
          // Get all enrollments for this student
          const { data: allEnrollments } = await supabase
            .from('enrollments')
            .select(`
              id,
              enrollment_date,
              class_group:class_groups(
                schedule:schedules(day_of_week)
              )
            `)
            .eq('student_id', cred.student_id);

          // Extract all days of week from all enrollments
          const classDays = (allEnrollments || [])
            .map((e: any) => e.class_group?.schedule?.day_of_week)
            .filter((day: string | undefined) => day);

          // Get the earliest enrollment date
          const enrollmentDates = (allEnrollments || [])
            .map((e: any) => e.enrollment_date)
            .filter((date: string | undefined) => date)
            .sort();

          return {
            ...cred,
            all_class_days: classDays,
            earliest_enrollment_date: enrollmentDates[0] || cred.enrollment?.enrollment_date
          };
        })
      );

      return new Response(
        JSON.stringify({ success: true, data: enrichedCredentials }),
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
        console.log('No lms_user_id found, looking up by matricula:', credential.matricula);
        studentUserId = await findStudentUUIDWithFallback(credential.matricula, credential.email, studentName);
        
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
          const parsed = JSON.parse(responseText) as any;

          // The LMS may return either { success, data } or a raw object
          const lmsData = parsed?.success ? parsed.data : parsed;

          if (lmsData) {
            const currentModule = typeof lmsData.current_module === 'string'
              ? lmsData.current_module
              : lmsData.current_module?.name || lmsData.current_module?.id || null;

            const currentLevel = typeof lmsData.current_level === 'string'
              ? lmsData.current_level
              : lmsData.current_level?.name || lmsData.current_level?.id || null;

            const currentLesson = typeof lmsData.current_lesson === 'string'
              ? lmsData.current_lesson
              : lmsData.current_lesson?.title || lmsData.current_lesson?.id || null;

            const completion = Number(lmsData.completion_percentage ?? 0);
            const userId = String(lmsData.user_id ?? studentUserId);

            const { error: updateError } = await supabase
              .from('lms_credentials')
              .update({
                current_module: currentModule,
                current_level: currentLevel,
                current_lesson: currentLesson,
                completion_percentage: completion,
                lms_user_id: userId,
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
                data: lmsData,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('LMS API response not successful or no data:', parsed);
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

        // If no UUID, look it up by matricula first (then email fallback)
        if (!studentUserId) {
          studentUserId = await findStudentUUIDWithFallback(cred.matricula, cred.email);
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
            const responseText = await lmsResponse.text();
            const parsed = JSON.parse(responseText) as any;
            const lmsData = parsed?.success ? parsed.data : parsed;

            if (lmsData) {
              const currentModule = typeof lmsData.current_module === 'string'
                ? lmsData.current_module
                : lmsData.current_module?.name || lmsData.current_module?.id || null;

              const currentLevel = typeof lmsData.current_level === 'string'
                ? lmsData.current_level
                : lmsData.current_level?.name || lmsData.current_level?.id || null;

              const currentLesson = typeof lmsData.current_lesson === 'string'
                ? lmsData.current_lesson
                : lmsData.current_lesson?.title || lmsData.current_lesson?.id || null;

              const completion = Number(lmsData.completion_percentage ?? 0);
              const userId = String(lmsData.user_id ?? studentUserId);

              await supabase
                .from('lms_credentials')
                .update({
                  current_module: currentModule,
                  current_level: currentLevel,
                  current_lesson: currentLesson,
                  completion_percentage: completion,
                  lms_user_id: userId,
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

    // Delete student from LMS
    if (action === 'deleteStudent') {
      const { studentId: localStudentId } = requestBody;
      
      // First, get the LMS credential for this student
      const { data: credential, error: credError } = await supabase
        .from('lms_credentials')
        .select('id, lms_user_id, matricula, email, student:students(name)')
        .eq('student_id', localStudentId)
        .maybeSingle();

      if (credError) {
        console.error('Error fetching credential for deletion:', credError);
        throw credError;
      }

      if (!credential) {
        console.log('No LMS credential found for student, nothing to delete in LMS');
        return new Response(
          JSON.stringify({ success: true, message: 'No LMS credential found for this student' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let lmsUserId = credential.lms_user_id;

      // If we don't have the LMS user ID, try to find it
      if (!lmsUserId) {
        const studentName = (credential.student as any)?.name;
        lmsUserId = await findStudentUUIDWithFallback(credential.matricula, credential.email, studentName);
      }

      // Delete from LMS using the new endpoint
      const LMS_DELETE_ENDPOINT = 'https://icbudgpjptemjfymssvr.supabase.co/functions/v1/delete-student';
      
      try {
        console.log('Deleting student from LMS:', { 
          matricula: credential.matricula, 
          email: credential.email,
          lmsUserId 
        });
        
        // Build delete payload - prefer matricula, fallback to email or user_id
        const deletePayload: Record<string, string> = {};
        if (credential.matricula) {
          deletePayload.matricula = credential.matricula;
        } else if (credential.email) {
          deletePayload.email = credential.email;
        } else if (lmsUserId) {
          deletePayload.user_id = lmsUserId;
        }

        if (Object.keys(deletePayload).length > 0) {
          const deleteResponse = await fetch(LMS_DELETE_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': getLmsApiKey(),
            },
            body: JSON.stringify(deletePayload),
          });

          const deleteResult = await deleteResponse.json();
          console.log('LMS delete response:', deleteResult);

          if (!deleteResponse.ok) {
            console.warn('Failed to delete student from LMS:', deleteResult);
          } else {
            console.log('Student successfully deleted from LMS');
          }
        } else {
          console.warn('No identifier available to delete student from LMS');
        }
      } catch (lmsError) {
        console.error('Error deleting student from LMS:', lmsError);
        // Don't throw - we still want to delete the local credential
      }

      // Delete the local LMS credential
      const { error: deleteCredError } = await supabase
        .from('lms_credentials')
        .delete()
        .eq('student_id', localStudentId);

      if (deleteCredError) {
        console.error('Error deleting local LMS credential:', deleteCredError);
        throw deleteCredError;
      }

      console.log('Student deleted from LMS and local credential removed');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Student deleted from LMS successfully',
          lmsUserId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ GET PARENT REPORT ============
    if (action === 'getParentReport') {
      const { studentUserId, matricula } = requestBody;
      
      if (!studentUserId && !matricula) {
        return new Response(
          JSON.stringify({ success: false, error: 'studentUserId or matricula is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const queryParam = studentUserId 
        ? `student_user_id=${encodeURIComponent(studentUserId)}`
        : `matricula=${encodeURIComponent(matricula)}`;
      
      console.log(`Fetching parent report with: ${queryParam}`);

      const response = await fetch(`${LMS_API_BASE}/get-parent-report?${queryParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getLmsApiKey(),
        },
      });

      console.log('Report API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Report API error:', errorText);
        return new Response(
          JSON.stringify({ success: false, error: `Report API error: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/pdf')) {
        // Convert PDF to base64 for JSON response (Supabase SDK doesn't handle binary well)
        const pdfBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(pdfBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Pdf = btoa(binary);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            isPdf: true,
            pdfBase64: base64Pdf,
            filename: 'relatorio-pedagogico.pdf'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Return JSON response
        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
