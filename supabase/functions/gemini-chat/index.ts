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
    const body = await req.json();
    const { messages, guardianName, studentNames, courseNames, purpose, tone, context } = body;
    
    // Auto-detect type based on provided parameters
    let type = body.type;
    if (!type) {
      if (purpose || tone || context) {
        type = 'generate';
      } else if (messages && Array.isArray(messages)) {
        type = 'suggest';
      }
    }
    
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "suggest") {
      systemPrompt = `Você é um assistente especializado em atendimento escolar via WhatsApp.
Analise as mensagens de conversa e sugira 3 respostas apropriadas para a escola enviar ao responsável.

Contexto:
- Nome do responsável: ${guardianName || 'Responsável'}
- Alunos: ${studentNames?.join(', ') || 'Não especificado'}
- Cursos: ${courseNames?.join(', ') || 'Não especificado'}

Retorne APENAS um JSON válido com o formato:
{
  "suggestions": [
    {"text": "texto da sugestão 1", "tone": "formal"},
    {"text": "texto da sugestão 2", "tone": "informal"},
    {"text": "texto da sugestão 3", "tone": "empático"}
  ]
}

Os tons possíveis são: "formal", "informal", "empático".
Mantenha as respostas curtas e adequadas para WhatsApp.`;

      const recentMessages = messages
        .slice(-10)
        .map((m: { direction: string; message: string }) => 
          `${m.direction === 'incoming' ? 'Responsável' : 'Escola'}: ${m.message}`
        )
        .join('\n');

      userPrompt = `Histórico da conversa:\n${recentMessages}\n\nSugira 3 respostas apropriadas.`;
    } else if (type === "summary") {
      systemPrompt = `Você é um assistente especializado em análise de conversas escolares.
Analise a conversa e forneça um resumo executivo.

Contexto:
- Nome do responsável: ${guardianName || 'Responsável'}
- Alunos: ${studentNames?.join(', ') || 'Não especificado'}
- Cursos: ${courseNames?.join(', ') || 'Não especificado'}

Retorne APENAS um JSON válido com o formato:
{
  "summary": "resumo da conversa em 2-3 frases",
  "mainTopics": ["tópico1", "tópico2"],
  "pendingActions": ["ação pendente 1", "ação pendente 2"],
  "sentiment": "positivo" | "neutro" | "negativo"
}`;

      const allMessages = messages
        .map((m: { direction: string; message: string }) => 
          `${m.direction === 'incoming' ? 'Responsável' : 'Escola'}: ${m.message}`
        )
        .join('\n');

      userPrompt = `Conversa completa:\n${allMessages}\n\nForneça o resumo.`;
    } else if (type === "generate") {
      systemPrompt = `Você é um assistente especializado em criar mensagens de WhatsApp para escolas e instituições de ensino.

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

      userPrompt = `Crie uma mensagem de WhatsApp com as seguintes características:
- Propósito: ${purpose || 'comunicado geral'}
- Tom: ${tone || 'profissional e amigável'}
- Contexto adicional: ${context || 'mensagem para responsáveis de alunos'}`;
    } else {
      throw new Error("Tipo de operação não suportado");
    }

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
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
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições excedido. Tente novamente em alguns minutos.",
            status: 429,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 403) {
        return new Response(
          JSON.stringify({
            error: "Chave de API inválida ou sem permissão.",
            status: 403,
            details: errorText,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Erro ao processar com IA",
          status: response.status,
          details: errorText,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse response based on type
    if (type === "suggest") {
      try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify({ suggestions: parsed.suggestions }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Could not parse suggestions");
      } catch (parseError) {
        console.error("Parse error:", parseError);
        return new Response(
          JSON.stringify({
            suggestions: [
              { text: "Olá! Como posso ajudar?", tone: "formal" },
              { text: "Oi! Em que posso ajudar?", tone: "informal" },
              { text: "Entendo sua situação. Como posso ajudar?", tone: "empático" },
            ],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (type === "summary") {
      try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Could not parse summary");
      } catch (parseError) {
        console.error("Parse error:", parseError);
        return new Response(
          JSON.stringify({
            summary: generatedText.slice(0, 200),
            mainTopics: [],
            pendingActions: [],
            sentiment: "neutro",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(JSON.stringify({ message: generatedText.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("gemini-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
