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
    const HUGGINGFACE_API_TOKEN = Deno.env.get("HUGGINGFACE_API_TOKEN");

    if (!HUGGINGFACE_API_TOKEN) {
      throw new Error("HUGGINGFACE_API_TOKEN is not configured");
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
            max_new_tokens: 500,
            temperature: 0.7,
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
      return new Response(JSON.stringify({ error: "Erro ao gerar mensagem com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedMessage = Array.isArray(data) 
      ? data[0]?.generated_text || ""
      : data.generated_text || "";

    return new Response(JSON.stringify({ message: generatedMessage.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("huggingface-generate-message error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
