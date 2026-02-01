import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// External Gemini 2.5 Flash API - consistent across all AI features
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

async function getGoogleApiKey(supabase: any): Promise<string | null> {
  const envKey = Deno.env.get("GOOGLE_API_KEY");
  if (envKey) {
    return envKey;
  }

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

    // Use external Google Gemini API Key - consistent with other AI features
    const GOOGLE_API_KEY = await getGoogleApiKey(supabase);
    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_API_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Chave da API do Google não configurada. Acesse Configurações > Inteligência Artificial para adicionar sua chave.",
        requires_api_key: true
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using external Gemini 2.5 Flash API for homework analysis");

    const { action, dateFrom, dateTo } = await req.json();

    // Helper function to find guardian by phone (with flexible matching)
    async function findGuardianByPhone(phone: string) {
      const phoneDigits = phone.replace(/\D/g, '');
      const variants = [
        phoneDigits,
        phoneDigits.startsWith('55') ? phoneDigits.slice(2) : `55${phoneDigits}`,
        phoneDigits.length === 11 ? phoneDigits.slice(0, 2) + phoneDigits.slice(3) : phoneDigits,
        phoneDigits.length === 10 ? phoneDigits.slice(0, 2) + '9' + phoneDigits.slice(2) : phoneDigits,
      ];
      
      for (const variant of variants) {
        const { data } = await supabase
          .from("guardians")
          .select("id, name, phone")
          .or(`phone.eq.${variant},phone.ilike.%${variant.slice(-8)}%`)
          .limit(1);
        
        if (data && data.length > 0) {
          return data[0];
        }
      }
      return null;
    }

    // Helper function to get students by guardian ID
    async function getStudentsByGuardianId(guardianId: string) {
      const { data } = await supabase
        .from("students")
        .select("id, name")
        .eq("guardian_id", guardianId)
        .eq("is_active", true);
      
      return data || [];
    }

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

      console.log(`Found ${messages?.length || 0} messages to analyze`);

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

      console.log(`${unprocessedMessages.length} unprocessed messages`);

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
      
      // Process messages in smaller batches with delay
      const batchSize = 3;
      const maxToProcess = Math.min(unprocessedMessages.length, 30);
      
      for (let i = 0; i < maxToProcess; i += batchSize) {
        const batch = unprocessedMessages.slice(i, i + batchSize);
        
        // Process each message individually
        for (const msg of batch) {
          const hasImage = msg.media_url && msg.media_type?.startsWith("image");
          
          // Build the prompt - very inclusive for homework detection
          const prompt = `Você é um assistente especializado em identificar conteúdo escolar em mensagens de WhatsApp.

Analise a seguinte mensagem${hasImage ? " e imagem" : ""} e identifique se contém QUALQUER informação sobre:
- Tarefas de casa / Dever de casa / Para casa
- Atividades escolares para fazer em casa
- Roteiro diário de estudos
- Agenda escolar com atividades
- Lições ou exercícios para entregar
- Conteúdo ministrado em aula com atividades pendentes
- Comunicados de escola com tarefas
- Agenda de atividades diárias

IMPORTANTE: Considere como dever de casa QUALQUER mensagem que mencione:
- "agenda de atividades diárias"
- "ATIVIDADE EM CASA" ou "ATIVIDADE DE CASA" ou "PARA CASA"
- "Atividade em sala"
- "Atividade de sala"
- "Páginas X a Y" para fazer
- "Data de entrega" ou "DATA DA ENTREGA" de atividades
- Tarefas com prazo
- Leitura obrigatória
- Exercícios para resolver
- Conteúdo ministrado com atividades pendentes
- Agenda diária de escola
- Roteiro de estudos
- "Senhores Pais e/ou Responsáveis"

${hasImage ? "ANALISE A IMAGEM COM ATENÇÃO: Pode ser print de agenda, foto de caderno, atividades, roteiro diário ou comunicado escolar." : ""}

Telefone do remetente: ${msg.phone}
Remetente: ${(msg.guardians as any)?.name || 'Escola/Grupo'}
Mensagem: "${msg.message || '(apenas imagem)'}"

Retorne um JSON válido:
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
  "imageDescription": "descrição da imagem se aplicável",
  "sourceInfo": "telefone ou nome do remetente"
}

ATENÇÃO MÁXIMA: 
- Se a mensagem mencionar "agenda de atividades diárias", "ATIVIDADE EM CASA", "Atividade em sala", "PARA CASA", "DATA DE ENTREGA", "páginas", agenda escolar ou similar, retorne isHomework=true com confidence >= 0.8.
- Mensagens de grupos escolares com roteiro diário são SEMPRE homework.
- Na dúvida, marque como isHomework=true para revisão manual.

Retorne APENAS o JSON, sem texto adicional.`;

          try {
            // Build content for Gemini API
            const parts: any[] = [{ text: prompt }];
            
            // Add image if present (as inline_data for Gemini)
            if (hasImage && msg.media_url) {
              console.log(`Fetching image for message ${msg.id}`);
              const imageBase64 = await fetchImageAsBase64(msg.media_url);
              if (imageBase64) {
                parts.push({
                  inline_data: {
                    mime_type: getMimeType(msg.media_url, msg.media_type),
                    data: imageBase64
                  }
                });
                console.log(`Image added for message ${msg.id}`);
              }
            }

            console.log(`Calling Gemini API for message ${msg.id}`);
            
            const aiResponse = await fetch(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 2048,
                }
              }),
            });

            if (!aiResponse.ok) {
              const errorText = await aiResponse.text();
              console.error(`AI error for message ${msg.id}:`, aiResponse.status, errorText);
              
              // Handle rate limiting gracefully
              if (aiResponse.status === 429) {
                console.log("Rate limited, waiting 3 seconds before continuing...");
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
              continue;
            }

            const aiData = await aiResponse.json();
            const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            
            console.log(`AI response for ${msg.id}:`, aiContent.substring(0, 200));

            try {
              const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                
                console.log(`Message ${msg.id}: isHomework=${analysis.isHomework}, confidence=${analysis.confidence}`);
                
                // Very low threshold to catch everything
                if (analysis.isHomework && analysis.confidence >= 0.2) {
                  // Try to find guardian by phone if not already linked
                  let guardianInfo = (msg.guardians as any);
                  let students: { id: string; name: string }[] = [];
                  
                  if (!guardianInfo && msg.phone) {
                    console.log(`Looking up guardian for phone: ${msg.phone}`);
                    guardianInfo = await findGuardianByPhone(msg.phone);
                  }
                  
                  // Get students linked to this guardian
                  if (guardianInfo?.id) {
                    students = await getStudentsByGuardianId(guardianInfo.id);
                    console.log(`Found ${students.length} students for guardian ${guardianInfo.name}`);
                  }
                  
                  const studentNames = students.map(s => s.name).join(', ');
                  const firstStudentId = students.length > 0 ? students[0].id : null;
                  
                  results.push({
                    messageId: msg.id,
                    phone: msg.phone,
                    message: msg.message,
                    mediaUrl: msg.media_url,
                    mediaType: msg.media_type,
                    hasImage: hasImage,
                    createdAt: msg.created_at,
                    guardianId: guardianInfo?.id || msg.guardian_id,
                    guardianName: guardianInfo?.name || 'Grupo/Escola',
                    sourcePhone: msg.phone,
                    studentId: firstStudentId,
                    studentNames: studentNames,
                    analysis: {
                      studentName: studentNames || analysis.studentName,
                      subjects: analysis.subjects,
                      activities: analysis.activities,
                      summary: analysis.summary,
                      parentNotes: analysis.parentNotes,
                      confidence: analysis.confidence,
                      hasImageContent: analysis.hasImageContent,
                      imageDescription: analysis.imageDescription,
                      sourceInfo: guardianInfo?.name || analysis.sourceInfo || msg.phone
                    }
                  });
                  console.log(`Added homework result for message ${msg.id} - Guardian: ${guardianInfo?.name}, Students: ${studentNames}`);
                }
              }
            } catch (parseError) {
              console.error(`Parse error for message ${msg.id}:`, parseError);
            }
          } catch (fetchError) {
            console.error(`Fetch error for message ${msg.id}:`, fetchError);
          }
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`Analysis complete: ${results.length} homework messages found`);

      return new Response(JSON.stringify({ 
        results,
        total: messages.length,
        analyzed: maxToProcess,
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
