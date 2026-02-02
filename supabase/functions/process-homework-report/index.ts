import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessRequest {
  messageId: string;
  guardianId: string;
  phone: string;
  message: string;
}

async function getGoogleApiKey(supabase: any): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "GOOGLE_API_KEY")
    .maybeSingle();

  if (error) {
    console.error("Error fetching GOOGLE_API_KEY from app_settings:", error);
    return null;
  }

  return data?.value || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Google API Key from database
    const GOOGLE_API_KEY = await getGoogleApiKey(supabase);

    const { messageId, guardianId, phone: _phone, message }: ProcessRequest = await req.json();

    if (!message || !guardianId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get guardian and student info
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id, name")
      .eq("id", guardianId)
      .single();

    if (!guardian) {
      console.log("Guardian not found:", guardianId);
      return new Response(JSON.stringify({ skipped: true, reason: "guardian_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get students enrolled in Reforço Escolar course
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        id,
        student_id,
        class_group_id,
        students!inner (id, name),
        class_groups!inner (
          id, 
          name,
          course_id,
          courses!inner (id, name)
        )
      `)
      .eq("guardian_id", guardianId)
      .eq("status", "active");

    // Filter only Reforço Escolar students
    const reforcoEnrollments = enrollments?.filter((e: any) => 
      e.class_groups?.courses?.name?.toLowerCase().includes("reforço") ||
      e.class_groups?.courses?.name?.toLowerCase().includes("reforco")
    ) || [];

    if (reforcoEnrollments.length === 0) {
      console.log("No Reforço Escolar students found for guardian:", guardian.name);
      return new Response(JSON.stringify({ skipped: true, reason: "not_reforco_student" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Use AI to classify if this is a homework report
    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_API_KEY not configured in app_settings");
      return new Response(JSON.stringify({ error: "Chave da API do Google não configurada. Acesse Configurações > Inteligência Artificial." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentNames = reforcoEnrollments.map((e: any) => e.students?.name).filter(Boolean);
    const classGroupNames = reforcoEnrollments.map((e: any) => e.class_groups?.name).filter(Boolean);

    const classificationPrompt = `Você é um assistente que classifica mensagens de pais de uma escola.

Analise a seguinte mensagem e determine:
1. Se é um relato de atividades/tarefas de casa (roteiro diário)
2. Se for, extraia e organize as informações de forma estruturada

Contexto:
- Responsável: ${guardian.name}
- Aluno(s): ${studentNames.join(", ")}
- Turma(s): ${classGroupNames.join(", ")}

Mensagem do responsável:
"${message}"

Responda em JSON com o formato:
{
  "isHomeworkReport": true/false,
  "confidence": 0.0-1.0,
  "studentName": "nome do aluno mencionado ou inferido",
  "activities": [
    {
      "subject": "matéria/área",
      "description": "descrição da atividade",
      "status": "realizada/não realizada/parcial",
      "observations": "observações adicionais"
    }
  ],
  "summary": "resumo breve do roteiro",
  "parentNotes": "observações gerais do pai"
}`;

    // Call Google Gemini API directly
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `Você é um classificador de mensagens escolares. Responda apenas em JSON válido.\n\n${classificationPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI classification error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI classification failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Extract JSON from response
    let classification;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      classification = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      classification = { isHomeworkReport: false, confidence: 0 };
    }

    console.log("AI Classification result:", classification);

    // If not a homework report with high confidence, skip
    if (!classification.isHomeworkReport || (classification.confidence || 0) < 0.6) {
      console.log("Message not classified as homework report, confidence:", classification.confidence);
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: "not_homework_report",
        confidence: classification.confidence 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Find the teacher for the student's class
    // First, identify which class group the mentioned student is in
    let targetClassGroupId = reforcoEnrollments[0]?.class_group_id;
    
    if (classification.studentName && reforcoEnrollments.length > 1) {
      const matchingEnrollment = reforcoEnrollments.find((e: any) => 
        e.students?.name?.toLowerCase().includes(classification.studentName?.toLowerCase())
      );
      if (matchingEnrollment) {
        targetClassGroupId = matchingEnrollment.class_group_id;
      }
    }

    // Find teacher for this class group
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id, name, phone, class_group_id")
      .eq("class_group_id", targetClassGroupId)
      .eq("is_active", true)
      .single();

    if (!teacher) {
      console.log("No teacher found for class group:", targetClassGroupId);
      
      // Store the report as pending (no teacher assigned)
      await supabase.from("homework_reports").insert({
        whatsapp_message_id: messageId || null,
        guardian_id: guardianId,
        student_id: reforcoEnrollments[0]?.student_id,
        original_message: message,
        processed_content: JSON.stringify(classification),
        status: "pending",
        error_message: "Nenhum professor cadastrado para esta turma",
      });

      return new Response(JSON.stringify({ 
        success: true, 
        status: "pending",
        reason: "no_teacher_assigned" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 5: Format the message for the teacher
    const fullStudentName = classification.studentName || studentNames[0] || "Aluno";
    // Extract first and second name for identification
    const nameParts = fullStudentName.trim().split(/\s+/);
    const studentDisplayName = nameParts.length >= 2 
      ? `${nameParts[0]} ${nameParts[1]}` 
      : nameParts[0];
    
    // Motivational messages pool
    const motivationalMessages = [
      "Continue o excelente trabalho! Juntos fazemos a diferença na educação. 💪",
      "Obrigado pelo acompanhamento! Seu apoio é essencial para o sucesso do aluno. ⭐",
      "Parabéns pelo comprometimento com a educação! 🌟",
      "Cada atividade é um passo rumo ao sucesso! Vamos em frente! 🚀",
      "O esforço de hoje constrói o amanhã. Continue motivando! 📚",
      "Seu acompanhamento faz toda a diferença. Obrigado! 🙏",
    ];
    const randomMotivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    
    let teacherMessage = `📚 *Roteiro de Atividades*\n👤 *Aluno(a):* ${studentDisplayName}\n\n`;
    
    if (classification.summary) {
      teacherMessage += `📋 *Resumo:* ${classification.summary}\n\n`;
    }

    if (classification.activities?.length > 0) {
      teacherMessage += `📖 *Atividades:*\n`;
      classification.activities.forEach((activity: any, index: number) => {
        const statusEmoji = activity.status === "realizada" ? "✅" : 
                           activity.status === "parcial" ? "⚠️" : "❌";
        teacherMessage += `${index + 1}. ${statusEmoji} ${activity.subject || "Geral"}: ${activity.description}\n`;
        if (activity.observations) {
          teacherMessage += `   _${activity.observations}_\n`;
        }
      });
      teacherMessage += `\n`;
    }

    if (classification.parentNotes) {
      teacherMessage += `💬 *Obs. do responsável:* ${classification.parentNotes}\n\n`;
    }

    teacherMessage += `_${randomMotivation}_\n\n`;
    
    const now = new Date();
    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const diaSemana = diasSemana[now.getUTCDay()];
    const dataFormatada = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
    const horaFormatada = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    
    teacherMessage += `_Recebido em ${diaSemana}, ${dataFormatada} às ${horaFormatada}_`;

    // Step 6: Send message to teacher via W-API
    const { data: wapiSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["W_API_URL", "W_API_TOKEN"]);

    const wapiUrl = wapiSettings?.find((s: any) => s.key === "W_API_URL")?.value || "https://api.w-api.app";
    const wapiToken = wapiSettings?.find((s: any) => s.key === "W_API_TOKEN")?.value;

    if (!wapiToken) {
      console.error("W-API token not configured");
      
      await supabase.from("homework_reports").insert({
        whatsapp_message_id: messageId || null,
        guardian_id: guardianId,
        student_id: reforcoEnrollments[0]?.student_id,
        teacher_id: teacher.id,
        original_message: message,
        processed_content: teacherMessage,
        status: "failed",
        error_message: "W-API não configurada",
      });

      return new Response(JSON.stringify({ error: "W-API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean teacher phone
    const teacherPhone = teacher.phone.replace(/\D/g, "");

    // Send message
    const sendResponse = await fetch(`${wapiUrl}/api/v1/messages/send-text`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${wapiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: teacherPhone,
        message: teacherMessage,
      }),
    });

    const sendResult = await sendResponse.json();
    const success = sendResponse.ok && (sendResult.success !== false);

    // Step 7: Store the report record
    await supabase.from("homework_reports").insert({
      whatsapp_message_id: messageId || null,
      guardian_id: guardianId,
      student_id: reforcoEnrollments[0]?.student_id,
      teacher_id: teacher.id,
      original_message: message,
      processed_content: teacherMessage,
      status: success ? "sent" : "failed",
      sent_at: success ? new Date().toISOString() : null,
      error_message: success ? null : JSON.stringify(sendResult),
    });

    console.log(`Homework report ${success ? "sent" : "failed"} to teacher ${teacher.name} (${teacherPhone})`);

    return new Response(JSON.stringify({ 
      success, 
      teacherName: teacher.name,
      studentName: studentDisplayName,
      classification 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Process homework report error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
