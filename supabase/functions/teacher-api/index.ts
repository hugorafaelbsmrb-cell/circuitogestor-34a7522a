import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// API Key for external system authentication
const TEACHER_API_KEY = 'teacher_api_circuitokids_2025';

interface StudentData {
  id: string;
  name: string;
}

interface CourseData {
  id: string;
  name: string;
}

interface ClassGroupData {
  id: string;
  name: string;
  course: CourseData;
}

interface EnrollmentData {
  id: string;
  student: StudentData;
  class_group: ClassGroupData;
}

interface TeacherData {
  id: string;
  name: string;
  phone: string;
  class_group_id: string | null;
}

interface TeacherCredentialData {
  id: string;
  email: string;
  matricula: string;
  is_active: boolean;
  teacher: TeacherData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== TEACHER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /teacher-api/students - List Reforço students
    if (req.method === 'GET' && path === 'students') {
      // Get all students enrolled in "Reforço" courses
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          student:students(id, name),
          class_group:class_groups(
            id,
            name,
            course:courses(id, name)
          )
        `)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching enrollments:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch students' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Filter only "Reforço" students
      const reforcoStudents = (enrollments as unknown as EnrollmentData[])?.filter(e => {
        const courseName = e.class_group?.course?.name?.toLowerCase() || '';
        return courseName.includes('reforço') || courseName.includes('reforco');
      }).map(e => ({
        id: e.student?.id,
        name: e.student?.name,
        matricula: e.id, // Enrollment ID as matricula
        turma: e.class_group?.name,
        curso: e.class_group?.course?.name,
      })) || [];

      return new Response(
        JSON.stringify({ 
          success: true, 
          count: reforcoStudents.length,
          students: reforcoStudents 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /teacher-api/teachers - List all teachers with their linked students
    if (req.method === 'GET' && path === 'teachers') {
      // Get all active teachers
      const { data: teachers, error: teachersError } = await supabase
        .from('teachers')
        .select('id, name, phone, email, is_active')
        .eq('is_active', true)
        .order('name');

      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch teachers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all students with their teacher links and guardian info
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          birth_date,
          sex,
          teacher_id,
          guardian:guardians(id, name, phone, email)
        `)
        .eq('is_active', true)
        .order('name');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch students' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials for each teacher
      const { data: credentials, error: credError } = await supabase
        .from('teacher_credentials')
        .select('teacher_id, email, matricula')
        .eq('is_active', true);

      // Build response with teachers and their students
      const teachersWithStudents = teachers?.map(teacher => {
        const teacherStudents = students?.filter(s => s.teacher_id === teacher.id) || [];
        const teacherCredential = credentials?.find(c => c.teacher_id === teacher.id);
        
        return {
          id: teacher.id,
          name: teacher.name,
          phone: teacher.phone,
          email: teacher.email,
          credential: teacherCredential ? {
            email: teacherCredential.email,
            matricula: teacherCredential.matricula,
          } : null,
          students_count: teacherStudents.length,
          students: teacherStudents.map(s => ({
            id: s.id,
            name: s.name,
            birth_date: s.birth_date,
            sex: s.sex,
            guardian_name: (s.guardian as { name?: string })?.name,
            guardian_phone: (s.guardian as { phone?: string })?.phone,
            guardian_email: (s.guardian as { email?: string })?.email,
          })),
        };
      }) || [];

      return new Response(
        JSON.stringify({ 
          success: true, 
          count: teachersWithStudents.length,
          total_students: students?.filter(s => s.teacher_id).length || 0,
          teachers: teachersWithStudents 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /teacher-api/teacher-students?teacher_id=xxx - Get teacher with linked students
    if (req.method === 'GET' && path === 'teacher-students') {
      const teacherId = url.searchParams.get('teacher_id');
      
      if (!teacherId) {
        return new Response(
          JSON.stringify({ error: 'teacher_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get teacher info
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('id, name, phone, email, is_active')
        .eq('id', teacherId)
        .single();

      if (teacherError || !teacher) {
        return new Response(
          JSON.stringify({ error: 'Teacher not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get students linked to this teacher
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          birth_date,
          sex,
          is_active,
          guardian:guardians(id, name, phone, email)
        `)
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch students' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          teacher: {
            id: teacher.id,
            name: teacher.name,
            phone: teacher.phone,
            email: teacher.email,
          },
          students_count: students?.length || 0,
          students: students?.map(s => ({
            id: s.id,
            name: s.name,
            birth_date: s.birth_date,
            sex: s.sex,
            guardian_name: (s.guardian as { name?: string })?.name,
            guardian_phone: (s.guardian as { phone?: string })?.phone,
          })) || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /teacher-api/auth - Authenticate teacher
    if (req.method === 'POST' && path === 'auth') {
      const { email, password } = await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: 'Email and password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: credential, error } = await supabase
        .from('teacher_credentials')
        .select(`
          id,
          email,
          matricula,
          is_active,
          teacher:teachers(id, name, phone)
        `)
        .eq('email', email.toLowerCase().trim())
        .eq('password', password)
        .eq('is_active', true)
        .single();

      if (error || !credential) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last login
      await supabase
        .from('teacher_credentials')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', credential.id);

      const teacherData = credential.teacher as unknown as TeacherData;

      return new Response(
        JSON.stringify({ 
          success: true, 
          teacher: {
            id: teacherData?.id,
            name: teacherData?.name,
            email: credential.email,
            matricula: credential.matricula,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /teacher-api/sync - Receive data from external system
    if (req.method === 'POST' && path === 'sync') {
      const body = await req.json();
      const { action, data } = body;

      if (action === 'update_attendance') {
        // External system sending attendance data
        console.log('Received attendance update:', data);
        return new Response(
          JSON.stringify({ success: true, message: 'Attendance data received' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'update_progress') {
        // External system sending student progress
        console.log('Received progress update:', data);
        return new Response(
          JSON.stringify({ success: true, message: 'Progress data received' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // NEW: Handle training/capacity progress updates
      if (action === 'update_training' || action === 'update_capacitacao') {
        console.log('Received training progress update:', data);
        
        // data format: { matricula, track_name, current_module, current_lesson, completed_lessons, total_lessons }
        const { matricula, track_name, current_module, current_lesson, completed_lessons, total_lessons } = data;

        if (!matricula || !track_name) {
          return new Response(
            JSON.stringify({ error: 'matricula and track_name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find teacher credential by matricula
        const { data: credential, error: credError } = await supabase
          .from('teacher_credentials')
          .select('id, teacher_id')
          .eq('matricula', matricula)
          .single();

        if (credError || !credential) {
          console.error('Teacher credential not found:', matricula);
          return new Response(
            JSON.stringify({ error: 'Teacher credential not found', matricula }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const completedCount = completed_lessons || 0;
        const totalCount = total_lessons || 0;
        const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        // Upsert training progress
        const { error: upsertError } = await supabase
          .from('teacher_training_progress')
          .upsert({
            teacher_id: credential.teacher_id,
            teacher_credential_id: credential.id,
            track_name,
            current_module: current_module || null,
            current_lesson: current_lesson || null,
            completed_lessons: completedCount,
            total_lessons: totalCount,
            completion_percentage: percentage,
            last_sync_at: new Date().toISOString(),
          }, {
            onConflict: 'teacher_credential_id,track_name',
          });

        if (upsertError) {
          // Try insert if upsert fails (no unique constraint yet)
          const { error: insertError } = await supabase
            .from('teacher_training_progress')
            .insert({
              teacher_id: credential.teacher_id,
              teacher_credential_id: credential.id,
              track_name,
              current_module: current_module || null,
              current_lesson: current_lesson || null,
              completed_lessons: completedCount,
              total_lessons: totalCount,
              completion_percentage: percentage,
              last_sync_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error saving training progress:', insertError);
            return new Response(
              JSON.stringify({ error: 'Failed to save training progress' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Training progress updated',
            matricula,
            track_name,
            completion_percentage: percentage.toFixed(2),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Unknown action', supported: ['update_attendance', 'update_progress', 'update_training'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found', endpoints: ['/students', '/teachers', '/teacher-students', '/auth', '/sync'] }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
