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
      systemPrompt = `Você é um copywriter especialista em comunicação escolar via WhatsApp. Sua missão é criar mensagens persuasivas, humanas e eficazes.

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
7. CTA (Call to Action): Termine com uma pergunta ou ação clara quando fizer sentido (ex: "Posso contar com você?", "Confirma pra gente?").
8. TAMANHO: Mensagens entre 150-400 caracteres (curtas o suficiente para ler rápido, longas o suficiente para transmitir valor).

EXEMPLOS DE BOAS MENSAGENS:
- Lead: "Olá, {nome_responsavel}! 😊 Vi que você demonstrou interesse no curso de *{curso}*. Nossos alunos estão tendo resultados incríveis! Posso te contar mais sobre as turmas disponíveis?"
- Lembrete: "Oi, {nome_responsavel}! 📚 Só passando pra lembrar que a aula de *{curso}* do(a) {nome_aluno} é amanhã. Esperamos vocês!"
- Geral: "Olá, {nome_responsavel}! Temos uma novidade especial para o(a) {nome_aluno} no curso de *{curso}*. Quando podemos conversar?"

PROIBIDO:
- Mensagens genéricas sem personalização
- Textos longos demais (mais de 500 caracteres)
- Excesso de formalidade ("Prezado(a)", "Vimos por meio desta")
- Emojis em excesso ou infantis

Retorne APENAS a mensagem final, sem explicações, títulos ou observações.`;

      userPrompt = `Crie uma mensagem de WhatsApp com estas especificações:
- PROPÓSITO: ${purpose || 'comunicado geral para responsáveis'}
- TOM DESEJADO: ${tone || 'profissional e amigável'}
- CONTEXTO: ${context || 'mensagem para responsáveis de alunos de uma escola/curso'}

Crie a melhor mensagem possível seguindo as diretrizes. Seja criativo e humano.`;
    } else {
      throw new Error("Tipo de operação não suportado");
    }

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

      // Google Gemini quota / rate limit
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const retryInfo = Array.isArray(errorJson?.error?.details)
          ? errorJson.error.details.find((d: any) => d?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo")
          : null;

        const retryDelayRaw: string | undefined = retryInfo?.retryDelay; // ex: "44s"
        const retryAfterSecondsFromBody = retryDelayRaw ? Number(String(retryDelayRaw).replace(/[^0-9.]/g, "")) : undefined;
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : retryAfterSecondsFromBody;

        // Se o Google devolver "limit: 0", é cota zerada (billing/plano)
        const isQuotaZero = typeof errorJson?.error?.message === "string" && errorJson.error.message.includes("limit: 0");

        return new Response(
          JSON.stringify({
            error: isQuotaZero
              ? "Cota da API externa do Google está zerada (limite 0). Ative billing/um plano no Google AI e tente novamente."
              : "Limite de requisições excedido. Aguarde e tente novamente.",
            status: 429,
            retry_after_seconds: retryAfterSeconds,
            provider_details: errorJson?.error?.status || undefined,
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
