import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LMSStudentPayload {
  nome: string;
  matricula: string;
  email?: string;
  data_nascimento?: string;
  curso?: string;
  apelido?: string;
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

// Generate PIN/password: first name (lowercase, no accents) + 2 first letters of second name
// Example: "João Silva" -> "joaosi"
function generatePin(fullName: string, matricula: string): string {
  const normalized = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  const nameParts = normalized.split(' ').filter(part => part.length > 0);
  
  if (nameParts.length === 0) {
    return 'aluno';
  }
  
  const firstName = nameParts[0];
  // Get first 2 letters of second name (if exists)
  const secondNamePrefix = nameParts.length > 1 ? nameParts[1].substring(0, 2) : '';
  
  return `${firstName}${secondNamePrefix}`;
}

function generateStudentEmail(fullName: string): string {
  const normalized = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  const nameParts = normalized.split(' ').filter(part => part.length > 0);
  
  if (nameParts.length === 0) {
    return `aluno@circuitokids.com.br`;
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  
  return lastName 
    ? `${firstName}.${lastName}@circuitokids.com.br`
    : `${firstName}@circuitokids.com.br`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lmsWebhookSecret = Deno.env.get('LMS_WEBHOOK_SECRET') || 'educacionalcircuuiToKIdsLTDA';
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

    // Generate matricula number using enrollment ID (last 7 chars)
    const matricula = `${new Date().getFullYear()}${enrollmentId.slice(-7).toUpperCase()}`;

    // Generate student email automatically
    const studentEmail = generateStudentEmail(student.name);

    // Build LMS payload according to API spec
    const lmsPayload: LMSStudentPayload = {
      nome: student.name,
      matricula: matricula,
      email: guardian.email, // Use guardian email as "responsável"
      data_nascimento: student.birth_date,
      curso: course.name,
    };

    console.log('Sending to external LMS:', lmsPayload);

    // Send to external LMS webhook with proper auth header
    const lmsWebhookUrl = 'https://icbudgpjptemjfymssvr.supabase.co/functions/v1/create-student-webhook';
    
    const lmsResponse = await fetch(lmsWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': lmsWebhookSecret,
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
          generatedPin: generatePin(student.name, matricula),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const generatedPin = generatePin(student.name, matricula);

    console.log('LMS integration successful!');
    console.log('Generated email:', studentEmail);
    console.log('Generated PIN:', generatedPin);

    // Save credentials to lms_credentials table
    const { error: credentialsError } = await supabase
      .from('lms_credentials')
      .upsert({
        student_id: studentId,
        enrollment_id: enrollmentId,
        email: studentEmail,
        password: generatedPin,
        matricula: matricula,
        completion_percentage: 0,
        lms_user_id: lmsResult.user_id || null,
      }, {
        onConflict: 'student_id,enrollment_id',
      });

    if (credentialsError) {
      console.error('Error saving LMS credentials:', credentialsError);
    } else {
      console.log('LMS credentials saved successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Student registered in LMS successfully',
        lmsIntegration: true,
        lmsResponse: lmsResult,
        credentials: {
          email: studentEmail,
          pin: generatedPin,
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
