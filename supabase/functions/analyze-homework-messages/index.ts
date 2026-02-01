import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Gemini API direct (using external API key)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

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

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch image:", response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

function getMimeType(url: string, mediaType?: string): string {
  if (mediaType?.includes("image/")) return mediaType;
  if (url.includes(".png")) return "image/png";
  if (url.includes(".gif")) return "image/gif";
  if (url.includes(".webp")) return "image/webp";
  return "image/jpeg";
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

    const { action, dateFrom, dateTo } = await req.json();

    if (action === "scan") {
      // Scan recent messages for homework content (including images)
      let query = supabase
        .from("whatsapp_messages")
        .select(`
          id,
          phone,
          message,
          created_at,
          guardian_id,
          media_url,
          media_type,
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

      const results: any[] = [];
      
      // Process messages in smaller batches to handle images properly
      const batchSize = 5;
      for (let i = 0; i < Math.min(unprocessedMessages.length, 30); i += batchSize) {
        const batch = unprocessedMessages.slice(i, i + batchSize);
        
        // Process each message individually when it has an image
        for (const msg of batch) {
          const hasImage = msg.media_url && msg.media_type?.startsWith("image");
          
          // Build the prompt
          const prompt = `Você é um assistente que analisa mensagens de WhatsApp de pais/responsáveis de uma escola.

Analise a seguinte mensagem${hasImage ? " e imagem" : ""} e identifique se contém informações sobre tarefas de casa, atividades escolares, roteiro diário de estudos ou deveres.

${hasImage ? "IMPORTANTE: Analise cuidadosamente a IMAGEM anexada. Ela pode conter:" : ""}
${hasImage ? "- Print/screenshot de agenda escolar" : ""}
${hasImage ? "- Foto de caderno com tarefas" : ""}
${hasImage ? "- Imagem de atividades ou exercícios" : ""}
${hasImage ? "- Print de comunicado da escola" : ""}

Responsável: ${(msg.guardians as any)?.name || 'Desconhecido'}
Mensagem de texto: "${msg.message || '(apenas imagem)'}"

Retorne um JSON com o formato:
{
  "isHomework": true/false,
  "confidence": 0.0-1.0,
  "studentName": "nome do aluno se mencionado ou identificado",
  "subjects": ["matérias identificadas"],
  "activities": [
    {
      "subject": "matéria",
      "description": "descrição da atividade",
      "status": "realizada/não realizada/parcial/a fazer"
    }
  ],
  "summary": "resumo breve do conteúdo",
  "parentNotes": "observações do responsável se houver",
  "hasImageContent": ${hasImage ? "true" : "false"},
  "imageDescription": "descrição do que foi identificado na imagem (se aplicável)"
}

Retorne APENAS o JSON, sem explicações adicionais.`;

          try {
            // Build content parts for Google Gemini API
            const contentParts: any[] = [];
            
            // Add image if present
            if (hasImage && msg.media_url) {
              const imageBase64 = await fetchImageAsBase64(msg.media_url);
              if (imageBase64) {
                contentParts.push({
                  inline_data: {
                    mime_type: getMimeType(msg.media_url, msg.media_type),
                    data: imageBase64
                  }
                });
              }
            }
            
            contentParts.push({ text: prompt });

            const aiResponse = await fetch(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: contentParts }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
              }),
            });

            if (!aiResponse.ok) {
              console.error("AI error for message", msg.id, ":", await aiResponse.text());
              continue;
            }

            const aiData = await aiResponse.json();
            const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

            try {
              const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                
                if (analysis.isHomework && analysis.confidence >= 0.5) {
                  results.push({
                    messageId: msg.id,
                    phone: msg.phone,
                    message: msg.message,
                    mediaUrl: msg.media_url,
                    mediaType: msg.media_type,
                    hasImage: hasImage,
                    createdAt: msg.created_at,
                    guardianId: msg.guardian_id,
                    guardianName: (msg.guardians as any)?.name,
                    analysis: {
                      studentName: analysis.studentName,
                      subjects: analysis.subjects,
                      activities: analysis.activities,
                      summary: analysis.summary,
                      parentNotes: analysis.parentNotes,
                      confidence: analysis.confidence,
                      hasImageContent: analysis.hasImageContent,
                      imageDescription: analysis.imageDescription
                    }
                  });
                }
              }
            } catch (parseError) {
              console.error("Parse error for message", msg.id, ":", parseError);
            }
          } catch (fetchError) {
            console.error("Fetch error for message", msg.id, ":", fetchError);
          }
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
            original_message: report.message || "(imagem)",
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