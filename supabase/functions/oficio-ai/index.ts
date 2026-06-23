const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, currentContent, oficioType, institution } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente especialista em redação de ofícios institucionais brasileiros, com domínio do padrão ABNT e da norma culta da língua portuguesa.

REGRAS DE REDAÇÃO:
- Linguagem formal, clara, objetiva e impessoal
- Estrutura: vocativo, exposição do assunto, fundamentação, solicitação/conclusão, fecho
- Use tratamento adequado (Vossa Senhoria, Excelentíssimo Senhor, Prezado(a))
- Parágrafos curtos e bem articulados
- Evite jargões, gírias ou linguagem coloquial
- Inclua chamadas claras à ação quando apropriado
- NÃO inclua cabeçalho com dados da instituição (logo, endereço, CNPJ) — isso é adicionado automaticamente no PDF
- NÃO inclua "Ofício Nº" no início — apenas o corpo do texto

INSTITUIÇÃO REMETENTE: ${institution?.name || "Instituição de Ensino"}
${institution?.address ? `Endereço: ${institution.address}` : ""}

RETORNE APENAS O TEXTO DO OFÍCIO em formato de parágrafos (sem markdown), pronto para ser inserido no documento.`;

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    if (currentContent) {
      messages.push({
        role: "user",
        content: `Conteúdo atual do ofício:\n\n${currentContent}\n\nSolicitação: ${prompt}`,
      });
    } else {
      messages.push({
        role: "user",
        content: `Tipo de ofício: ${oficioType || "geral"}\n\nSolicitação: ${prompt}`,
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
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no painel do Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao chamar IA", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content: content.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("oficio-ai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
