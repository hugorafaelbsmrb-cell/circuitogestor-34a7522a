import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LMSStudentPayload {
  nome: string;
  email: string;
  data_nascimento: string;
  curso: string;
  turma: string;
  matricula: string;
}

// Courses that should trigger LMS integration
const LMS_ELIGIBLE_COURSES = [
  'robótica',
  'robotica',
  'programação',
  'programacao',
  'coding',
  'tecnologia',
];

function isLMSEligibleCourse(courseName: string): boolean {
  const normalizedName = courseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return LMS_ELIGIBLE_COURSES.some(eligible => 
    normalizedName.includes(eligible.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

function generatePassword(name: string, birthDate: string): string {
  // Get first 3 letters of the first name (lowercase)
  const firstName = name.split(' ')[0].toLowerCase();
  const firstThree = firstName.substring(0, 3);
  
  // Get year from birth date (format: YYYY-MM-DD)
  const year = birthDate.split('-')[0];
  
  return `${firstThree}${year}`;
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

    const { enrollmentId, studentId, guardianId, courseId, classGroupId } = await req.json();

    console.log('LMS Webhook called with:', { enrollmentId, studentId, guardianId, courseId, classGroupId });

    // Fetch student data
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Error fetching student:', studentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Student not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch guardian data (for email)
    const { data: guardian, error: guardianError } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', guardianId)
      .single();

    if (guardianError || !guardian) {
      console.error('Error fetching guardian:', guardianError);
      return new Response(
        JSON.stringify({ success: false, error: 'Guardian not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch course data
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Error fetching course:', courseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Course not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if course is eligible for LMS integration
    if (!isLMSEligibleCourse(course.name)) {
      console.log(`Course "${course.name}" is not eligible for LMS integration`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Course not eligible for LMS integration',
          lmsIntegration: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch class group data
    const { data: classGroup, error: classGroupError } = await supabase
      .from('class_groups')
      .select('*')
      .eq('id', classGroupId)
      .single();

    if (classGroupError || !classGroup) {
      console.error('Error fetching class group:', classGroupError);
      return new Response(
        JSON.stringify({ success: false, error: 'Class group not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Generate matricula number using enrollment ID (last 7 chars)
    const matricula = `${new Date().getFullYear()}${enrollmentId.slice(-7).toUpperCase()}`;

    // Build LMS payload
    const lmsPayload: LMSStudentPayload = {
      nome: student.name,
      email: guardian.email,
      data_nascimento: student.birth_date,
      curso: course.name,
      turma: classGroup.name,
      matricula: matricula,
    };

    console.log('Sending to external LMS:', lmsPayload);

    // Send to external LMS webhook
    const lmsWebhookUrl = 'https://icbudgpjptemjfymssvr.supabase.co/functions/v1/create-student-webhook';
    
    const lmsResponse = await fetch(lmsWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lmsPayload),
    });

    const lmsResponseText = await lmsResponse.text();
    console.log('LMS Response status:', lmsResponse.status);
    console.log('LMS Response body:', lmsResponseText);

    let lmsResult;
    try {
      lmsResult = JSON.parse(lmsResponseText);
    } catch {
      lmsResult = { raw: lmsResponseText };
    }

    if (!lmsResponse.ok) {
      console.error('LMS webhook error:', lmsResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'LMS webhook failed',
          lmsResponse: lmsResult,
          generatedPassword: generatePassword(student.name, student.birth_date),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const generatedPassword = generatePassword(student.name, student.birth_date);

    console.log('LMS integration successful!');
    console.log('Generated password:', generatedPassword);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Student registered in LMS successfully',
        lmsIntegration: true,
        lmsResponse: lmsResult,
        credentials: {
          email: guardian.email,
          password: generatedPassword,
          matricula: matricula,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('LMS webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
