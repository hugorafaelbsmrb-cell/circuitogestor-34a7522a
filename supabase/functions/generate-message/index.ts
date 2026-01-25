import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleApiKey(): Promise<string | null> {
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
    const { context, tone, purpose } = await req.json();
    
    // Fetch API key dynamically from database
    const GOOGLE_API_KEY = await getGoogleApiKey();

    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Chave da API do Google não configurada. Acesse Configurações > Inteligência Artificial para adicionar sua chave.",
          status: 400,
          requires_api_key: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      if (response.status === 403) {
        return new Response(
          JSON.stringify({
            error: "Chave de API inválida ou sem permissão. Verifique sua chave nas configurações.",
            status: 403,
            details: errorText,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
