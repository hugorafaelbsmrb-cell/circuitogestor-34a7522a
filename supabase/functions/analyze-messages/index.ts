import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  direction: 'incoming' | 'outgoing';
  message: string;
  created_at: string;
}

async function getGoogleApiKey(): Promise<string | null> {
  // First try to get from environment (Supabase Secrets)
  const envKey = Deno.env.get("GOOGLE_API_KEY");
  if (envKey) {
    return envKey;
  }

  // Fallback to app_settings table
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not configured");
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, type, guardianName, studentNames, courseNames } = await req.json();
    
    // Get Google API Key from database
    const GOOGLE_API_KEY = await getGoogleApiKey();

    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "Chave da API do Google não configurada. Acesse Configurações > Inteligência Artificial." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma mensagem para analisar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build conversation context
    const conversation = messages.map((msg: Message) => {
      const sender = msg.direction === 'incoming' ? guardianName : 'Escola';
      return `[${sender}]: ${msg.message}`;
    }).join('\n');

    let promptText = '';

    if (type === 'suggest') {
      promptText = `Você é um assistente de atendimento escolar especializado em comunicação com responsáveis.
Sua tarefa é analisar a conversa e sugerir 3 respostas curtas e apropriadas.

Contexto:
- Responsável: ${guardianName || 'Responsável'}
- Alunos: ${studentNames?.join(', ') || 'Não especificado'}
- Cursos: ${courseNames?.join(', ') || 'Não especificado'}

Regras:
- Cada sugestão deve ter no máximo 150 caracteres
- Use linguagem amigável mas profissional
- Considere o tom e contexto da última mensagem recebida
- Não use emojis em excesso (máximo 1-2 por sugestão)
- Retorne APENAS um JSON válido com array "suggestions" contendo objetos com campos "text" e "tone" (formal/informal/empático)

Conversa atual:
${conversation}

Gere 3 sugestões de resposta para a última mensagem do responsável.`;
    } else if (type === 'summary') {
      promptText = `Você é um assistente que resume conversas de atendimento escolar.

Contexto:
- Responsável: ${guardianName || 'Responsável'}
- Alunos: ${studentNames?.join(', ') || 'Não especificado'}
- Cursos: ${courseNames?.join(', ') || 'Não especificado'}

Regras:
- Faça um resumo conciso (máximo 200 palavras)
- Destaque os pontos principais discutidos
- Identifique qualquer pendência ou ação necessária
- Use bullet points para organizar
- Retorne APENAS um JSON válido com campos "summary" (texto do resumo), "mainTopics" (array de tópicos), "pendingActions" (array de ações pendentes), "sentiment" (positivo/neutro/negativo)

Conversa completa:
${conversation}

Resuma esta conversa identificando os pontos principais.`;
    } else {
      return new Response(JSON.stringify({ error: "Tipo de análise inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Google Gemini API directly
    const response = await fetch(
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
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao analisar mensagens com IA", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Extract JSON from response
    let parsedContent;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      parsedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      parsedContent = type === 'suggest' 
        ? { suggestions: [] } 
        : { summary: aiContent, mainTopics: [], pendingActions: [], sentiment: 'neutro' };
    }

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-messages error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
