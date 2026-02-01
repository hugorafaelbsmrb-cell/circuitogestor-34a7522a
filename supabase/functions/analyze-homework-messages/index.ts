import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleApiKey(): Promise<string | null> {
  const envKey = Deno.env.get("GOOGLE_API_KEY");
  if (envKey) return envKey;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "GOOGLE_API_KEY")
    .maybeSingle();

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

    const GOOGLE_API_KEY = await getGoogleApiKey();
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "Chave da API do Google não configurada" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, messageIds, dateFrom, dateTo } = await req.json();

    if (action === "scan") {
      // Scan recent messages for homework content
      let query = supabase
        .from("whatsapp_messages")
        .select(`
          id,
          phone,
          message,
          created_at,
          guardian_id,
          guardians!whatsapp_messages_guardian_id_fkey (
            id,
            name,
            phone
          )
        `)
        .eq("direction", "incoming")
        .order("created_at", { ascending: false })
        .limit(100);

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo);
      }

      const { data: messages, error: messagesError } = await query;

      if (messagesError) {
        throw new Error(`Failed to fetch messages: ${messagesError.message}`);
      }

      if (!messages || messages.length === 0) {
        return new Response(JSON.stringify({ 
          results: [],
          total: 0,
          analyzed: 0,
          homeworkFound: 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Filter messages that haven't been processed yet
      const { data: existingReports } = await supabase
        .from("homework_reports")
        .select("whatsapp_message_id");
      
      const processedIds = new Set(existingReports?.map(r => r.whatsapp_message_id) || []);
      const unprocessedMessages = messages.filter(m => !processedIds.has(m.id));

      if (unprocessedMessages.length === 0) {
        return new Response(JSON.stringify({ 
          results: [],
          total: messages.length,
          analyzed: 0,
          homeworkFound: 0,
          message: "Todas as mensagens já foram analisadas"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Batch analyze messages with AI
      const batchSize = 10;
      const results: any[] = [];

      for (let i = 0; i < Math.min(unprocessedMessages.length, 30); i += batchSize) {
        const batch = unprocessedMessages.slice(i, i + batchSize);
        
        const batchPrompt = `Você é um assistente que analisa mensagens de WhatsApp de pais/responsáveis de uma escola.

Analise as seguintes mensagens e identifique quais contêm informações sobre tarefas de casa, atividades escolares ou roteiro diário de estudos.

Mensagens para análise:
${batch.map((m, idx) => `[${idx + 1}] De: ${(m.guardians as any)?.name || 'Desconhecido'}\nMensagem: "${m.message}"\n`).join('\n')}

Para cada mensagem, retorne um JSON com o formato:
{
  "analyses": [
    {
      "index": 1,
      "isHomework": true/false,
      "confidence": 0.0-1.0,
      "studentName": "nome do aluno se mencionado",
      "subjects": ["matérias identificadas"],
      "activities": [
        {
          "subject": "matéria",
          "description": "descrição da atividade",
          "status": "realizada/não realizada/parcial"
        }
      ],
      "summary": "resumo breve",
      "parentNotes": "observações do responsável"
    }
  ]
}

Retorne APENAS o JSON, sem explicações adicionais.`;

        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: batchPrompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            }),
          }
        );

        if (!aiResponse.ok) {
          console.error("AI error:", await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            for (const analysis of parsed.analyses || []) {
              const msgIndex = analysis.index - 1;
              const originalMsg = batch[msgIndex];
              
              if (originalMsg && analysis.isHomework && analysis.confidence >= 0.6) {
                results.push({
                  messageId: originalMsg.id,
                  phone: originalMsg.phone,
                  message: originalMsg.message,
                  createdAt: originalMsg.created_at,
                  guardianId: originalMsg.guardian_id,
                  guardianName: (originalMsg.guardians as any)?.name,
                  analysis: {
                    studentName: analysis.studentName,
                    subjects: analysis.subjects,
                    activities: analysis.activities,
                    summary: analysis.summary,
                    parentNotes: analysis.parentNotes,
                    confidence: analysis.confidence
                  }
                });
              }
            }
          }
        } catch (parseError) {
          console.error("Parse error:", parseError);
        }
      }

      return new Response(JSON.stringify({ 
        results,
        total: messages.length,
        analyzed: Math.min(unprocessedMessages.length, 30),
        homeworkFound: results.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      // Save analyzed messages to homework_reports
      const { reports } = await req.json();
      
      const inserted = [];
      for (const report of reports || []) {
        const { data, error } = await supabase
          .from("homework_reports")
          .insert({
            whatsapp_message_id: report.messageId,
            guardian_id: report.guardianId,
            student_id: report.studentId || null,
            teacher_id: report.teacherId || null,
            original_message: report.message,
            processed_content: JSON.stringify(report.analysis),
            status: "pending"
          })
          .select()
          .single();

        if (!error && data) {
          inserted.push(data);
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        inserted: inserted.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-homework-messages error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
