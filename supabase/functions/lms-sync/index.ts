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

// ============================================================
// STANDARDIZED FLEXIBLE MATRICULA SEARCH
// Searches by: exact matricula, case-insensitive, email, name
// Used across all LMS actions for consistency
// ============================================================

interface FlexibleSearchResult {
  student_user_id: string | null;
  matched_by: string | null;
}

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
    console.log('List-students response body:', responseText.substring(0, 500));

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

// Try exact matricula match first (direct API call if supported)
async function findByExactMatricula(matricula: string): Promise<string | null> {
  try {
    // Try direct matricula lookup endpoint if available
    const response = await fetch(`${LMS_API_BASE}/list-students?matricula=${encodeURIComponent(matricula)}&limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getLmsApiKey(),
      },
    });

    if (response.ok) {
      const result: LMSStudentListResponse = JSON.parse(await response.text());
      if (result.success && result.data && result.data.length > 0) {
        console.log('Found by exact matricula:', result.data[0].student_user_id);
        return result.data[0].student_user_id;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding by exact matricula:', error);
    return null;
  }
}

// Standardized flexible search with multiple fallback strategies
async function flexibleStudentSearch(
  matricula: string, 
  email?: string, 
  studentName?: string
): Promise<FlexibleSearchResult> {
  console.log('=== FLEXIBLE STUDENT SEARCH ===');
  console.log('Searching with:', { matricula, email, studentName });
  
  // Strategy 1: Exact matricula match
  console.log('Strategy 1: Trying exact matricula match...');
  let uuid = await findByExactMatricula(matricula);
  if (uuid) {
    console.log('✓ Found by exact matricula');
    return { student_user_id: uuid, matched_by: 'exact_matricula' };
  }
  
  // Strategy 2: Case-insensitive matricula search
  console.log('Strategy 2: Trying case-insensitive matricula search...');
  uuid = await findStudentUUID(matricula.toLowerCase());
  if (uuid) {
    console.log('✓ Found by case-insensitive matricula');
    return { student_user_id: uuid, matched_by: 'case_insensitive_matricula' };
  }
  
  // Try uppercase variant
  uuid = await findStudentUUID(matricula.toUpperCase());
  if (uuid) {
    console.log('✓ Found by uppercase matricula');
    return { student_user_id: uuid, matched_by: 'uppercase_matricula' };
  }
  
  // Strategy 3: Email search
  if (email) {
    console.log('Strategy 3: Trying email search:', email);
    uuid = await findStudentUUID(email);
    if (uuid) {
      console.log('✓ Found by email');
      return { student_user_id: uuid, matched_by: 'email' };
    }
  }
  
  // Strategy 4: Student name search
  if (studentName) {
    console.log('Strategy 4: Trying name search:', studentName);
    uuid = await findStudentUUID(studentName);
    if (uuid) {
      console.log('✓ Found by student name');
      return { student_user_id: uuid, matched_by: 'student_name' };
    }
  }
  
  console.log('✗ Student not found by any search strategy');
  return { student_user_id: null, matched_by: null };
}

// Legacy function maintained for backward compatibility
async function findStudentUUIDWithFallback(matricula: string, email?: string, studentName?: string): Promise<string | null> {
  const result = await flexibleStudentSearch(matricula, email, studentName);
  return result.student_user_id;
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

    // Get curriculum structure (modules, levels, lessons) from LMS
    if (action === 'getCurriculum') {
      // Helper to normalize names from various API response formats
      const extractName = (item: any): string => {
        if (!item) return '';
        return item.name || item.title || item.nome || item.titulo || item.label || String(item.id || '');
      };

      const parseArrayPayload = (parsed: any, keys: string[]) => {
        if (!parsed) return [];
        for (const k of keys) {
          const v = parsed?.[k];
          if (Array.isArray(v)) return v;
        }
        return Array.isArray(parsed) ? parsed : [];
      };

      const fetchAsArray = async (url: string, keys: string[]) => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': getLmsApiKey(),
          },
        });
        const text = await res.text();
        console.log('Curriculum fetch:', url, 'status:', res.status, 'body:', text.substring(0, 600));
        if (!res.ok) {
          throw new Error(`Curriculum endpoint failed: ${url} (${res.status})`);
        }
        try {
          const parsed = JSON.parse(text);
          return parseArrayPayload(parsed, keys);
        } catch {
          return [];
        }
      };
      
      try {
        // Modules
        const rawModules = await fetchAsArray(`${LMS_API_BASE}/list-modules`, ['data', 'modules']);

        // Normalize module data
        const modules = rawModules.map((m: any) => ({
          id: m.id,
          name: extractName(m),
          order_index: m.order_index || m.order || m.ordem || 0
        })).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));

        // Levels
        // Observação: alguns backends só retornam corretamente o vínculo (module_id) quando filtrado.
        // Então buscamos por módulo e garantimos module_id no retorno.
        let rawLevels: any[] = [];
        if (modules.length > 0) {
          const levelsByModule = await Promise.all(
            modules.map(async (m: any) => {
              const url = `${LMS_API_BASE}/list-levels?module_id=${encodeURIComponent(m.id)}`;
              const arr = await fetchAsArray(url, ['data', 'levels']);
              return arr.map((l: any) => ({ ...l, __module_id: m.id }));
            })
          );
          rawLevels = levelsByModule.flat();
        } else {
          rawLevels = await fetchAsArray(`${LMS_API_BASE}/list-levels`, ['data', 'levels']);
        }

        const levels = rawLevels
          .map((l: any) => ({
            id: l.id,
            name: extractName(l),
            module_id: l.module_id || l.moduleId || l.modulo_id || l.__module_id || null,
            level_number: l.level_number || l.number || l.numero || l.order || 0,
          }))
          .filter((l: any) => !!l.id)
          .sort((a: any, b: any) => (a.level_number || 0) - (b.level_number || 0));

        // Lessons
        // A API permite filtros opcionais; para garantir vínculo e reduzir payload, buscamos por nível.
        let rawLessons: any[] = [];
        if (levels.length > 0) {
          const lessonsByLevel = await Promise.all(
            levels.map(async (lvl: any) => {
              const qs = new URLSearchParams();
              qs.set('level_id', lvl.id);
              if (lvl.module_id) qs.set('module_id', lvl.module_id);
              const url = `${LMS_API_BASE}/list-lessons?${qs.toString()}`;
              const arr = await fetchAsArray(url, ['data', 'lessons']);
              return arr.map((ls: any) => ({ ...ls, __level_id: lvl.id, __module_id: lvl.module_id }));
            })
          );
          rawLessons = lessonsByLevel.flat();
        } else {
          rawLessons = await fetchAsArray(`${LMS_API_BASE}/list-lessons`, ['data', 'lessons']);
        }

        // De-dup (caso algum endpoint retorne repetidos)
        const seenLessonIds = new Set<string>();
        const lessons = rawLessons
          .map((l: any) => ({
            id: l.id,
            title: extractName(l),
            level_id: l.level_id || l.levelId || l.nivel_id || l.__level_id || null,
            module_id: l.module_id || l.moduleId || l.modulo_id || l.__module_id || null,
            lesson_number: l.lesson_number || l.number || l.numero || l.order || 0,
          }))
          .filter((l: any) => {
            if (!l.id) return false;
            if (seenLessonIds.has(l.id)) return false;
            seenLessonIds.add(l.id);
            return true;
          })
          .sort((a: any, b: any) => (a.lesson_number || 0) - (b.lesson_number || 0));

        console.log(`Curriculum loaded: ${modules.length} modules, ${levels.length} levels, ${lessons.length} lessons`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            modules,
            levels,
            lessons
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Error fetching curriculum:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch curriculum' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // LMS Management Actions (POST to external LMS - uses flexible matricula search)
    // New API: set_lesson, set_level, set_module with automatic XP/coins credit
    if (action === 'setLesson') {
      const { matricula, lessonId } = requestBody;
      return await callLMSAction('set_lesson', { matricula, lesson_id: lessonId }, supabase);
    }

    if (action === 'setLevel') {
      const { matricula, levelId } = requestBody;
      return await callLMSAction('set_level', { matricula, level_id: levelId }, supabase);
    }

    if (action === 'setModule') {
      const { matricula, moduleId } = requestBody;
      return await callLMSAction('set_module', { matricula, module_id: moduleId }, supabase);
    }

    // Legacy actions (kept for compatibility but may not work with new API)
    if (action === 'unlockLevel') {
      const { matricula, levelId } = requestBody;
      // Map to new set_level action
      return await callLMSAction('set_level', { matricula, level_id: levelId }, supabase);
    }

    if (action === 'updateLessonStatus') {
      const { matricula, lessonId } = requestBody;
      // Map to new set_lesson action
      return await callLMSAction('set_lesson', { matricula, lesson_id: lessonId }, supabase);
    }

    if (action === 'resetProgress') {
      const { matricula } = requestBody;
      // Reset by setting to first lesson/level/module - needs specific IDs
      return new Response(
        JSON.stringify({ success: false, message: 'Reset progress requires specific first lesson/level/module IDs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      let failedCount = 0;
      const now = new Date().toISOString();
      
      for (const cred of credentials || []) {
        console.log(`Processing credential: ${cred.id}, matricula: ${cred.matricula}`);
        let studentUserId = cred.lms_user_id;

        // If no UUID, look it up by matricula first (then email fallback)
        if (!studentUserId) {
          console.log(`No UUID found, searching for matricula: ${cred.matricula}`);
          studentUserId = await findStudentUUIDWithFallback(cred.matricula, cred.email);
          if (studentUserId) {
            console.log(`Found UUID: ${studentUserId} for matricula: ${cred.matricula}`);
            await supabase
              .from('lms_credentials')
              .update({ lms_user_id: studentUserId })
              .eq('id', cred.id);
          }
        }

        if (!studentUserId) {
          console.log(`Skipping credential ${cred.id}: no UUID found for matricula ${cred.matricula}`);
          failedCount++;
          continue;
        }

        try {
          const apiUrl = `${LMS_API_BASE}/lms-student-progress?student_user_id=${studentUserId}`;
          console.log(`Fetching progress from: ${apiUrl}`);
          
          const lmsResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': getLmsApiKey(),
            },
          });

          console.log(`LMS response status for ${cred.matricula}: ${lmsResponse.status}`);

          if (lmsResponse.ok) {
            const responseText = await lmsResponse.text();
            console.log(`LMS response for ${cred.matricula}: ${responseText.substring(0, 200)}...`);
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

              console.log(`Updating credential ${cred.id}: module=${currentModule}, level=${currentLevel}, lesson=${currentLesson}, completion=${completion}%`);

              const { error: updateError } = await supabase
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

              if (updateError) {
                console.error(`Error updating credential ${cred.id}:`, updateError);
                failedCount++;
              } else {
                syncedCount++;
                console.log(`Successfully synced credential ${cred.id}`);
              }
            } else {
              console.log(`No data in LMS response for ${cred.matricula}`);
              failedCount++;
            }
          } else {
            const errorText = await lmsResponse.text();
            console.error(`LMS API error for ${cred.matricula}: ${lmsResponse.status} - ${errorText}`);
            failedCount++;
          }
        } catch (err) {
          console.error(`Error syncing credential ${cred.id}:`, err);
          failedCount++;
        }
      }
      
      console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);

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
      const { matricula, format, levelId } = requestBody;
      
      if (!matricula) {
        return new Response(
          JSON.stringify({ success: false, error: 'matricula is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const requestFormat = format || 'pdf_data';
      
      // External LMS API anon key (public, required by the API)
      const LMS_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljYnVkZ3BqcHRlbWpmeW1zc3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDA4NjYsImV4cCI6MjA4NDE3Njg2Nn0.FkdaED4uk45rKzWTkZbFE7WUYlMPZgc1ovyAMFzL34Q';

      // Get the student_user_id from our database - this is REQUIRED for the external API
      const { data: credential } = await supabase
        .from('lms_credentials')
        .select('lms_user_id, email, student:students(name)')
        .eq('matricula', matricula)
        .maybeSingle();
      
      let studentUserId = credential?.lms_user_id;
      
      // If we don't have it cached, look it up in the LMS
      if (!studentUserId) {
        const studentName = (credential?.student as any)?.name;
        const email = credential?.email;
        console.log('No lms_user_id cached, looking up by matricula/email/name...');
        studentUserId = await findStudentUUIDWithFallback(matricula, email, studentName);
        
        // Save it for future use
        if (studentUserId && credential) {
          await supabase
            .from('lms_credentials')
            .update({ lms_user_id: studentUserId })
            .eq('matricula', matricula);
          console.log('Saved lms_user_id for future use:', studentUserId);
        }
      }

      // The external API REQUIRES student_user_id to work properly
      if (!studentUserId) {
        console.error('Could not find student_user_id for matricula:', matricula);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Aluno não encontrado no sistema LMS. Sincronize o progresso primeiro.' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build query parameters - ALWAYS use student_user_id (matricula alone doesn't work)
      let queryParams = `student_user_id=${encodeURIComponent(studentUserId)}&format=${requestFormat}`;
      
      // Add optional level_id if provided (recommended for auto-generation)
      if (levelId) {
        queryParams += `&level_id=${encodeURIComponent(levelId)}`;
      }
      
      console.log(`Fetching parent report with: ${queryParams}`);

      const response = await fetch(`${LMS_API_BASE}/get-parent-report?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getLmsApiKey(),
          'apikey': LMS_ANON_KEY,
        },
      });

      console.log('Report API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Report API error:', errorText);
        
        // Parse error message if possible
        let errorMessage = `Report API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          // Keep default error message
        }
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
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
            filename: `relatorio-pedagogico-${matricula}.pdf`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Return JSON response - API returns { success, student, reports, meta }
        const data = await response.json();
        console.log('Report API response data keys:', Object.keys(data));
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            student: data.student,
            reports: data.reports || [],
            meta: data.meta
          }),
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

// ============================================================
// HELPER FUNCTION TO CALL LMS MANAGEMENT ACTIONS
// Uses standardized flexible search when matricula fails
// ============================================================
async function callLMSAction(
  actionType: string, 
  params: Record<string, string>,
  supabaseClient?: any
) {
  // External LMS API anon key (public, required by the API)
  const LMS_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljYnVkZ3BqcHRlbWpmeW1zc3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDA4NjYsImV4cCI6MjA4NDE3Njg2Nn0.FkdaED4uk45rKzWTkZbFE7WUYlMPZgc1ovyAMFzL34Q';
  
  const matricula = params.matricula;
  
  // Helper to make the actual API call
  const makeApiCall = async (identifier: string, identifierType: 'matricula' | 'student_user_id') => {
    const requestBody: Record<string, string> = {
      action: actionType,
    };
    
    // Use the appropriate identifier
    if (identifierType === 'student_user_id') {
      requestBody.student_user_id = identifier;
    } else {
      requestBody.matricula = identifier;
    }
    
    // Add the specific ID based on action type
    if (params.lesson_id) requestBody.lesson_id = params.lesson_id;
    if (params.level_id) requestBody.level_id = params.level_id;
    if (params.module_id) requestBody.module_id = params.module_id;
    
    console.log(`Calling LMS action: ${actionType}`, requestBody);
    
    const response = await fetch(`${LMS_API_BASE}/lms-student-progress`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': getLmsApiKey(),
        'apikey': LMS_ANON_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`LMS API response (${response.status}):`, responseText);
    
    let result: any = null;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    return { response, result, responseText };
  };
  
  try {
    // First attempt: Try with matricula directly
    console.log('=== LMS ACTION: First attempt with matricula ===');
    let { response, result } = await makeApiCall(matricula, 'matricula');
    
    // Check if it failed due to student not found
    const notFound = !response.ok || 
                     result?.error?.includes('not found') || 
                     result?.error?.includes('Student not found') ||
                     result?.message?.includes('not found');
    
    // If failed, try flexible search to find the student
    if (notFound) {
      console.log('=== LMS ACTION: Matricula failed, trying flexible search ===');
      
      // Get email and name from local database if we have supabase client
      let email: string | undefined;
      let studentName: string | undefined;
      
      if (supabaseClient) {
        const { data: credential } = await supabaseClient
          .from('lms_credentials')
          .select('email, student:students(name)')
          .eq('matricula', matricula)
          .maybeSingle();
        
        if (credential) {
          email = credential.email;
          studentName = (credential.student as any)?.name;
        }
      }
      
      // Use flexible search
      const searchResult = await flexibleStudentSearch(matricula, email, studentName);
      
      if (searchResult.student_user_id) {
        console.log(`Found student via ${searchResult.matched_by}, retrying action...`);
        
        // Retry with student_user_id
        const retryResult = await makeApiCall(searchResult.student_user_id, 'student_user_id');
        response = retryResult.response;
        result = retryResult.result;
        
        // If successful, update the lms_user_id in our database for future calls
        if (response.ok && result?.success && supabaseClient) {
          await supabaseClient
            .from('lms_credentials')
            .update({ lms_user_id: searchResult.student_user_id })
            .eq('matricula', matricula);
          console.log('Updated lms_user_id for future calls');
        }
      } else {
        console.log('Student not found by any search strategy');
      }
    }

    const success = Boolean(response.ok && result?.success);
    
    // Build detailed message
    let message = result?.message || result?.error || (success ? 'Ação concluída' : 'Aluno não encontrado no LMS');
    
    // Add XP/coins info if available
    if (success && result) {
      const details: string[] = [];
      if (result.xp_credited) details.push(`+${result.xp_credited} XP`);
      if (result.coins_credited) details.push(`+${result.coins_credited} moedas`);
      if (result.lessons_completed) details.push(`${result.lessons_completed} aulas completadas`);
      if (details.length > 0) {
        message = `${message} (${details.join(', ')})`;
      }
    }

    // IMPORTANT: return 200 even when the external API fails.
    return new Response(
      JSON.stringify({
        success,
        message,
        lesson_id: result?.lesson_id,
        level_id: result?.level_id,
        module_id: result?.module_id,
        xp_credited: result?.xp_credited,
        coins_credited: result?.coins_credited,
        lessons_completed: result?.lessons_completed,
        external_status: response.status,
        external_response: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error(`Error calling LMS action ${actionType}:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro na API do LMS' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
