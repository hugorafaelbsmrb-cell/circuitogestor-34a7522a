import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  direction: 'incoming' | 'outgoing';
  message: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, type, guardianName, studentNames, courseNames } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'suggest') {
      systemPrompt = `Você é um assistente de atendimento escolar especializado em comunicação com responsáveis.
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
- Retorne APENAS um JSON válido com array "suggestions" contendo objetos com campos "text" e "tone" (formal/informal/empático)`;

      userPrompt = `Conversa atual:\n${conversation}\n\nGere 3 sugestões de resposta para a última mensagem do responsável.`;
    } else if (type === 'summary') {
      systemPrompt = `Você é um assistente que resume conversas de atendimento escolar.

Contexto:
- Responsável: ${guardianName || 'Responsável'}
- Alunos: ${studentNames?.join(', ') || 'Não especificado'}
- Cursos: ${courseNames?.join(', ') || 'Não especificado'}

Regras:
- Faça um resumo conciso (máximo 200 palavras)
- Destaque os pontos principais discutidos
- Identifique qualquer pendência ou ação necessária
- Use bullet points para organizar
- Retorne APENAS um JSON válido com campos "summary" (texto do resumo), "mainTopics" (array de tópicos), "pendingActions" (array de ações pendentes), "sentiment" (positivo/neutro/negativo)`;

      userPrompt = `Conversa completa:\n${conversation}\n\nResuma esta conversa identificando os pontos principais.`;
    } else {
      return new Response(JSON.stringify({ error: "Tipo de análise inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao analisar mensagens com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Parse the JSON response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsedContent = type === 'suggest' 
        ? { suggestions: [] } 
        : { summary: content, mainTopics: [], pendingActions: [], sentiment: 'neutro' };
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
