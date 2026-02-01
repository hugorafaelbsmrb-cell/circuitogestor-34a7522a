import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI Gateway - higher rate limits than Google free tier
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getLovableApiKey(): string | null {
  return Deno.env.get("LOVABLE_API_KEY") || null;
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

    const LOVABLE_API_KEY = getLovableApiKey();
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "Chave da API Lovable não configurada" 
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
      
      // Process messages in smaller batches
      const batchSize = 5;
      for (let i = 0; i < Math.min(unprocessedMessages.length, 30); i += batchSize) {
        const batch = unprocessedMessages.slice(i, i + batchSize);
        
        // Process each message individually
        for (const msg of batch) {
          const hasImage = msg.media_url && msg.media_type?.startsWith("image");
          
          // Build the prompt - more inclusive for homework detection
          const prompt = `Você é um assistente especializado em identificar conteúdo escolar em mensagens de WhatsApp.

Analise a seguinte mensagem${hasImage ? " e imagem" : ""} e identifique se contém QUALQUER informação sobre:
- Tarefas de casa / Dever de casa
- Atividades escolares para fazer em casa
- Roteiro diário de estudos
- Agenda escolar com atividades
- Lições ou exercícios para entregar
- Conteúdo ministrado em aula com atividades pendentes

IMPORTANTE: Considere como dever de casa qualquer mensagem que mencione:
- "ATIVIDADE EM CASA" ou "ATIVIDADE DE CASA"
- "Páginas X a Y" para fazer
- "Data de entrega" ou "DATA DA ENTREGA" de atividades
- Tarefas com prazo
- Leitura obrigatória
- Exercícios para resolver
- Conteúdo ministrado com atividades pendentes

${hasImage ? "ANALISE A IMAGEM: Pode ser print de agenda, foto de caderno, atividades ou comunicado escolar." : ""}

Remetente: ${(msg.guardians as any)?.name || 'Escola/Grupo'}
Mensagem: "${msg.message || '(apenas imagem)'}"

Retorne um JSON:
{
  "isHomework": true/false,
  "confidence": 0.0-1.0,
  "studentName": "série/turma ou nome se identificado",
  "subjects": ["matérias identificadas"],
  "activities": [
    {
      "subject": "matéria",
      "description": "descrição da atividade",
      "status": "a fazer/realizada/parcial"
    }
  ],
  "summary": "resumo das atividades pendentes",
  "parentNotes": "observações adicionais",
  "hasImageContent": ${hasImage ? "true" : "false"},
  "imageDescription": "descrição da imagem se aplicável"
}

ATENÇÃO: Se a mensagem mencionar "ATIVIDADE EM CASA", "ATIVIDADE DE CASA", "DATA DE ENTREGA" ou similar, retorne isHomework=true com confidence >= 0.7.
Retorne APENAS o JSON.`;

          try {
            // Build content for Lovable AI Gateway (OpenAI-compatible format)
            const messageContent: any[] = [];
            
            // Add image if present (as base64 data URL)
            if (hasImage && msg.media_url) {
              const imageBase64 = await fetchImageAsBase64(msg.media_url);
              if (imageBase64) {
                messageContent.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${getMimeType(msg.media_url, msg.media_type)};base64,${imageBase64}`
                  }
                });
              }
            }
            
            messageContent.push({ type: "text", text: prompt });

            const aiResponse = await fetch(LOVABLE_AI_URL, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LOVABLE_API_KEY}`
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: messageContent }],
                temperature: 0.3,
                max_tokens: 2048,
              }),
            });

            if (!aiResponse.ok) {
              const errorText = await aiResponse.text();
              console.error("AI error for message", msg.id, ":", errorText);
              
              // Handle rate limiting gracefully
              if (aiResponse.status === 429) {
                console.log("Rate limited, waiting before continuing...");
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
              continue;
            }

            const aiData = await aiResponse.json();
            const aiContent = aiData.choices?.[0]?.message?.content || "{}";

            try {
              const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                
                // Lower threshold to catch more homework messages
                if (analysis.isHomework && analysis.confidence >= 0.3) {
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
