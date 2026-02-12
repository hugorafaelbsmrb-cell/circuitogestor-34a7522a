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

    // GET /teacher-api/teachers - List all teachers with their linked students and courses
    if (req.method === 'GET' && path === 'teachers') {
      const courseFilter = url.searchParams.get('course_id');

      let teachersQuery = supabase
        .from('teachers')
        .select(`
          id, name, phone, email, is_active, course_id,
          course:courses(id, name)
        `)
        .eq('is_active', true)
        .order('name');

      if (courseFilter) {
        teachersQuery = teachersQuery.eq('course_id', courseFilter);
      }

      const { data: teachers, error: teachersError } = await teachersQuery;

      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch teachers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all active enrollments with student, class_group, and course info
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          id,
          student:students(id, name, birth_date, sex, is_active, guardian:guardians(id, name, phone, email)),
          class_group:class_groups(id, name, course_id, course:courses(id, name))
        `)
        .eq('status', 'active');

      if (enrollError) {
        console.error('Error fetching enrollments:', enrollError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch enrollments' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get credentials for each teacher
      const { data: credentials } = await supabase
        .from('teacher_credentials')
        .select('teacher_id, email, matricula')
        .eq('is_active', true);

      // Build response: match students to teachers via course_id
      const teachersWithStudents = teachers?.map(teacher => {
        const courseData = teacher.course as unknown as { id: string; name: string } | null;
        const teacherCredential = credentials?.find(c => c.teacher_id === teacher.id);

        // Find students enrolled in courses that match this teacher's course_id
        const matchedStudents: Array<{
          id: string; name: string; birth_date: string; sex: string;
          enrollment_id: string; class_group: string; course: string;
          guardian_name: string | undefined; guardian_phone: string | undefined; guardian_email: string | undefined;
        }> = [];
        const seenStudentIds = new Set<string>();

        if (teacher.course_id && enrollments) {
          for (const enrollment of enrollments as any[]) {
            const student = enrollment.student;
            const classGroup = enrollment.class_group;
            if (!student || !classGroup || !student.is_active) continue;
            
            const enrollmentCourseId = classGroup.course_id || classGroup.course?.id;
            if (enrollmentCourseId !== teacher.course_id) continue;

            // Avoid duplicate students (same student in multiple class_groups of same course)
            const key = `${student.id}`;
            if (seenStudentIds.has(key)) continue;
            seenStudentIds.add(key);

            matchedStudents.push({
              id: student.id,
              name: student.name,
              birth_date: student.birth_date,
              sex: student.sex,
              enrollment_id: enrollment.id,
              class_group: classGroup.name,
              course: classGroup.course?.name || courseData?.name || '',
              guardian_name: student.guardian?.name,
              guardian_phone: student.guardian?.phone,
              guardian_email: student.guardian?.email,
            });
          }
        }

        return {
          id: teacher.id,
          name: teacher.name,
          phone: teacher.phone,
          email: teacher.email,
          course: courseData ? { id: courseData.id, name: courseData.name } : null,
          credential: teacherCredential ? { email: teacherCredential.email, matricula: teacherCredential.matricula } : null,
          students_count: matchedStudents.length,
          students: matchedStudents,
        };
      }) || [];

      // Count unique students across all teachers
      const allStudentIds = new Set<string>();
      teachersWithStudents.forEach(t => t.students.forEach(s => allStudentIds.add(s.id)));

      return new Response(
        JSON.stringify({
          success: true,
          count: teachersWithStudents.length,
          total_students: allStudentIds.size,
          course_filter: courseFilter || null,
          teachers: teachersWithStudents,
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

      // NEW: Handle student reports from external system
      if (action === 'create_report' || action === 'send_report') {
        console.log('Received student report:', data);
        
        const { student_id, teacher_id, title, content, report_date, report_type } = data;

        if (!student_id || !title || !content) {
          return new Response(
            JSON.stringify({ error: 'student_id, title, and content are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify student exists
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, name')
          .eq('id', student_id)
          .single();

        if (studentError || !student) {
          return new Response(
            JSON.stringify({ error: 'Student not found', student_id }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Optionally verify teacher
        let teacherId = teacher_id;
        if (teacher_id) {
          const { data: teacher, error: teacherError } = await supabase
            .from('teachers')
            .select('id')
            .eq('id', teacher_id)
            .single();

          if (teacherError) {
            console.warn('Teacher not found:', teacher_id);
            teacherId = null;
          }
        }

        // Create the report
        const { data: report, error: insertError } = await supabase
          .from('student_reports')
          .insert({
            student_id,
            teacher_id: teacherId,
            title,
            content,
            report_date: report_date || new Date().toISOString().split('T')[0],
            report_type: report_type || 'pedagogical',
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating report:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create report', details: insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Report created successfully',
            report_id: report.id,
            student_name: student.name,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Unknown action', supported: ['update_attendance', 'update_progress', 'update_training', 'create_report'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /teacher-api/reports - List all reports
    if (req.method === 'GET' && path === 'reports') {
      const studentId = url.searchParams.get('student_id');
      const teacherId = url.searchParams.get('teacher_id');
      const status = url.searchParams.get('status');

      let query = supabase
        .from('student_reports')
        .select(`
          id,
          title,
          content,
          report_date,
          report_type,
          status,
          sent_at,
          created_at,
          student:students(id, name),
          teacher:teachers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (studentId) query = query.eq('student_id', studentId);
      if (teacherId) query = query.eq('teacher_id', teacherId);
      if (status) query = query.eq('status', status);

      const { data: reports, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching reports:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch reports' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          count: reports?.length || 0,
          reports,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found', endpoints: ['/students', '/teachers', '/teacher-students', '/auth', '/sync', '/reports'] }),
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
