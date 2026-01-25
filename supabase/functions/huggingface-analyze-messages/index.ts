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
    const HUGGINGFACE_API_TOKEN = Deno.env.get("HUGGINGFACE_API_TOKEN");

    if (!HUGGINGFACE_API_TOKEN) {
      throw new Error("HUGGINGFACE_API_TOKEN is not configured");
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
    let jsonFormat = '';

    if (type === 'suggest') {
      jsonFormat = '{"suggestions": [{"text": "sugestão 1", "tone": "formal"}, {"text": "sugestão 2", "tone": "informal"}, {"text": "sugestão 3", "tone": "empático"}]}';
      
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
- Retorne APENAS um JSON válido com o formato: ${jsonFormat}`;

      userPrompt = `Conversa atual:\n${conversation}\n\nGere 3 sugestões de resposta para a última mensagem do responsável. Responda APENAS com JSON válido.`;
    } else if (type === 'summary') {
      jsonFormat = '{"summary": "texto do resumo", "mainTopics": ["tópico 1", "tópico 2"], "pendingActions": ["ação 1"], "sentiment": "neutro"}';
      
      systemPrompt = `Você é um assistente que resume conversas de atendimento escolar.

Contexto:
- Responsável: ${guardianName || 'Responsável'}
- Alunos: ${studentNames?.join(', ') || 'Não especificado'}
- Cursos: ${courseNames?.join(', ') || 'Não especificado'}

Regras:
- Faça um resumo conciso (máximo 200 palavras)
- Destaque os pontos principais discutidos
- Identifique qualquer pendência ou ação necessária
- Retorne APENAS um JSON válido com o formato: ${jsonFormat}
- sentiment deve ser: positivo, neutro ou negativo`;

      userPrompt = `Conversa completa:\n${conversation}\n\nResuma esta conversa identificando os pontos principais. Responda APENAS com JSON válido.`;
    } else {
      return new Response(JSON.stringify({ error: "Tipo de análise inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      "https://api-inference.huggingface.co/models/meta-llama/Llama-3-8B-Instruct",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`,
          parameters: {
            max_new_tokens: 800,
            temperature: 0.5,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Hugging Face API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao analisar mensagens com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = Array.isArray(data) 
      ? data[0]?.generated_text || "{}"
      : data.generated_text || "{}";
    
    // Try to extract JSON from the response
    let parsedContent;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      parsedContent = type === 'suggest' 
        ? { suggestions: [{ text: "Obrigado pelo contato! Como posso ajudar?", tone: "formal" }] } 
        : { summary: content, mainTopics: [], pendingActions: [], sentiment: 'neutro' };
    }

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("huggingface-analyze-messages error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
