import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const DEFAULT_WAPI_URL = 'https://api.w-api.app';

interface SiteContactRequest {
  name: string;
  phone: string;
  interested_course_id?: string;
  course_name?: string; // Fallback if ID not provided
  message?: string;
}

// Normalize phone to W-API format (55 + DDD + number)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length >= 10 && digits.length <= 11) {
    return '55' + digits;
  }
  return digits;
}

// Get first name only for friendly greeting
function getFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[0] || fullName;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key if required
    const apiKey = req.headers.get('x-api-key');
    if (apiKey) {
      const { data: storedKey } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'external_api_key')
        .maybeSingle();
      
      if (storedKey?.value && storedKey.value !== apiKey) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { name, phone, interested_course_id, course_name, message }: SiteContactRequest = await req.json();

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Nome e telefone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    console.log(`Processing site contact lead: ${name}, phone: ${normalizedPhone}`);

    // Check if lead already exists with same phone
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, name')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingLead) {
      console.log('Lead already exists:', existingLead.id);
      
      // Update notes with new message if provided
      if (message) {
        await supabase
          .from('leads')
          .update({ 
            notes: message,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLead.id);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead já cadastrado - atualizado',
          lead_id: existingLead.id,
          is_duplicate: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to fetch WhatsApp profile picture
    let avatarUrl: string | null = null;
    const { data: wapiSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['W_API_TOKEN', 'W_API_SESSION', 'W_API_INSTANCE_ID', 'W_API_URL']);

    const wapiConfig: Record<string, string> = {};
    wapiSettings?.forEach(s => {
      if (s.value) wapiConfig[s.key] = s.value;
    });

    const instanceId = wapiConfig.W_API_INSTANCE_ID || wapiConfig.W_API_SESSION;

    if (wapiConfig.W_API_TOKEN && instanceId) {
      try {
        const baseUrl = (wapiConfig.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
        const profileUrl = `${baseUrl}/v1/contact/profile-picture?instanceId=${encodeURIComponent(instanceId)}&phone=${normalizedPhone}`;
        
        const profileRes = await fetch(profileUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${wapiConfig.W_API_TOKEN}` },
        });
        
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          avatarUrl = profileData?.profilePictureUrl || profileData?.imgUrl || null;
          console.log('Fetched profile picture:', avatarUrl ? 'yes' : 'no');
        }
      } catch (err) {
        console.error('Error fetching profile picture:', err);
      }
    }

    // Resolve course ID if only name was provided
    let courseId = interested_course_id || null;
    let resolvedCourseName = course_name || 'nossos cursos';
    
    if (!courseId && course_name) {
      const { data: course } = await supabase
        .from('courses')
        .select('id, name')
        .ilike('name', `%${course_name}%`)
        .maybeSingle();
      
      if (course) {
        courseId = course.id;
        resolvedCourseName = course.name;
      }
    } else if (courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('name')
        .eq('id', courseId)
        .maybeSingle();
      
      if (course?.name) {
        resolvedCourseName = course.name;
      }
    }

    // Create the lead
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name,
        phone: normalizedPhone,
        interested_course_id: courseId,
        source: 'site_contact_form',
        status: 'new',
        avatar_url: avatarUrl,
        notes: message || null,
      })
      .select('id')
      .single();

    if (leadError) {
      console.error('Error creating lead:', leadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead created:', newLead.id);

    // Check if auto_site_contact_welcome automation is enabled
    const { data: automation } = await supabase
      .from('automation_settings')
      .select('enabled, config')
      .eq('key', 'auto_site_contact_welcome')
      .maybeSingle();

    if (!automation?.enabled) {
      console.log('auto_site_contact_welcome automation is disabled');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead cadastrado com sucesso',
          lead_id: newLead.id,
          whatsapp_sent: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get message template and school name
    const { data: templateSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['whatsapp_template_site_contact', 'system_name']);

    const templates: Record<string, string> = {};
    templateSettings?.forEach(s => {
      if (s.value) templates[s.key] = s.value;
    });

    const messageTemplate = templates.whatsapp_template_site_contact || 
      'Olá {nome_responsavel}! 👋\n\nRecebemos sua mensagem através do nosso site.\n\nObrigado pelo interesse em {nome_curso}!\n\nEm breve nossa equipe entrará em contato.\n\nAbraços! 🚀';
    const schoolName = templates.system_name || 'nossa escola';

    // Replace variables in template
    let finalMessage = messageTemplate
      .replace(/{nome_responsavel}/g, getFirstName(name))
      .replace(/{nome_curso}/g, resolvedCourseName)
      .replace(/{nome_escola}/g, schoolName)
      .replace(/\\n/g, '\n');

    console.log('Sending welcome message...');

    // Send WhatsApp message
    if (wapiConfig.W_API_TOKEN && instanceId) {
      try {
        const baseUrl = (wapiConfig.W_API_URL || DEFAULT_WAPI_URL).replace(/\/+$/, '');
        const sendUrl = `${baseUrl}/v1/message/send-text?instanceId=${encodeURIComponent(instanceId)}`;
        
        const sendRes = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wapiConfig.W_API_TOKEN}`,
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            message: finalMessage,
          }),
        });

        const sendResult = await sendRes.json();
        console.log('WhatsApp send result:', sendRes.ok ? 'success' : 'failed', sendResult);

        if (sendRes.ok) {
          // Log the message
          await supabase
            .from('message_logs')
            .insert({
              phone: normalizedPhone,
              lead_id: newLead.id,
              template_category: 'site_contact',
              message_preview: finalMessage.substring(0, 100),
              automation_key: 'auto_site_contact_welcome',
              status: 'sent',
            });

          // Also save to whatsapp_messages
          await supabase
            .from('whatsapp_messages')
            .insert({
              phone: normalizedPhone,
              message: finalMessage,
              direction: 'outgoing',
              status: 'sent',
              wapi_message_id: sendResult?.id || sendResult?.key?.id || null,
            });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Lead cadastrado e mensagem enviada!',
              lead_id: newLead.id,
              whatsapp_sent: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (err) {
        console.error('Error sending WhatsApp:', err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lead cadastrado (WhatsApp não configurado)',
        lead_id: newLead.id,
        whatsapp_sent: false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in site-contact-lead:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
