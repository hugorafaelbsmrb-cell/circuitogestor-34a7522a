import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const systemPrompt = `Você é um copywriter especialista em comunicação escolar via WhatsApp. Sua missão é criar mensagens persuasivas, humanas e eficazes.

DIRETRIZES DE QUALIDADE:
1. ABERTURA: Sempre comece com uma saudação calorosa usando {nome_responsavel} (ex: "Olá, {nome_responsavel}! 😊")
2. CLAREZA: Vá direto ao ponto após a saudação. Cada frase deve ter um propósito claro.
3. PERSONALIZAÇÃO: Use as variáveis para tornar a mensagem pessoal e relevante:
   - {nome_responsavel} → primeiro nome do responsável
   - {nome_aluno} → nome do aluno
   - {nomes_alunos} → lista de alunos separados por vírgula
   - {curso} → nome do curso
   - {cursos} → lista de cursos
4. FORMATAÇÃO WHATSAPP: Use *negrito* para destacar informações importantes (datas, valores, ações).
5. TOM: Seja genuíno e próximo, como alguém que realmente se importa com o aluno. Evite linguagem corporativa fria.
6. EMOJIS: Use 1-3 emojis estratégicos (no início ou para pontuar informações), nunca aleatórios.
7. CTA (Call to Action): Termine com uma pergunta ou ação clara quando fizer sentido.
8. TAMANHO: Mensagens entre 150-400 caracteres.

PROIBIDO:
- Mensagens genéricas sem personalização
- Textos longos demais (mais de 500 caracteres)
- Excesso de formalidade ("Prezado(a)", "Vimos por meio desta")
- Emojis em excesso ou infantis

Retorne APENAS a mensagem final, sem explicações.`;

    const userPrompt = `Crie uma mensagem de WhatsApp com estas especificações:
- PROPÓSITO: ${purpose || 'comunicado geral para responsáveis'}
- TOM DESEJADO: ${tone || 'profissional e amigável'}
- CONTEXTO: ${context || 'mensagem para responsáveis de alunos de uma escola/curso'}

Crie a melhor mensagem possível. Seja criativo e humano.`;

    // Call Google Gemini API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
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
            temperature: 0.8,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0,
            },
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
