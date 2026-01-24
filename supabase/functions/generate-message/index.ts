import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context, tone, purpose } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um assistente especializado em criar mensagens de WhatsApp para escolas e instituições de ensino.

Regras importantes:
- Crie mensagens curtas e diretas (máximo 300 caracteres se possível)
- Use linguagem amigável e profissional
- Inclua as variáveis de personalização quando apropriado:
  - {nome_responsavel} - nome do responsável
  - {nome_aluno} - nome do primeiro aluno
  - {nomes_alunos} - todos os alunos separados por vírgula
  - {curso} - nome do primeiro curso
  - {cursos} - todos os cursos separados por vírgula
- NÃO use emojis em excesso (máximo 2-3)
- A mensagem deve ser adequada para WhatsApp (informal mas respeitosa)

Retorne APENAS a mensagem, sem explicações adicionais.`;

    const userPrompt = `Crie uma mensagem de WhatsApp com as seguintes características:
- Propósito: ${purpose || 'comunicado geral'}
- Tom: ${tone || 'profissional e amigável'}
- Contexto adicional: ${context || 'mensagem para responsáveis de alunos'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
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
      return new Response(JSON.stringify({ error: "Erro ao gerar mensagem com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedMessage = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message: generatedMessage.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-message error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
