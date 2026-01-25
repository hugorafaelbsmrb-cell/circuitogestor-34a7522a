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
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
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

      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // ignore
      }

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const retryInfo = Array.isArray(errorJson?.error?.details)
          ? errorJson.error.details.find((d: any) => d?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo")
          : null;

        const retryDelayRaw: string | undefined = retryInfo?.retryDelay;
        const retryAfterSecondsFromBody = retryDelayRaw ? Number(String(retryDelayRaw).replace(/[^0-9.]/g, "")) : undefined;
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : retryAfterSecondsFromBody;

        const isQuotaZero = typeof errorJson?.error?.message === "string" && errorJson.error.message.includes("limit: 0");

        return new Response(
          JSON.stringify({
            error: isQuotaZero
              ? "Cota da API externa do Google está zerada (limite 0). Ative billing/um plano no Google AI e tente novamente."
              : "Limite de requisições excedido. Aguarde e tente novamente.",
            status: 429,
            retry_after_seconds: retryAfterSeconds,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
            },
          }
        );
      }

      return new Response(JSON.stringify({ error: "Erro ao gerar mensagem com IA", status: response.status, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
