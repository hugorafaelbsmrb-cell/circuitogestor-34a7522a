import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('[contract-sign] Request received:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[contract-sign] CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('[contract-sign] Supabase URL:', supabaseUrl ? 'present' : 'missing');
    console.log('[contract-sign] Service key:', supabaseServiceKey ? 'present' : 'missing');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[contract-sign] Request body keys:', Object.keys(body));
    
    const { token, signatureImage, signatureHash, userAgent } = body;

    if (!token || !signatureImage) {
      console.error('[contract-sign] Missing required fields - token:', !!token, 'signature:', !!signatureImage);
      return new Response(
        JSON.stringify({ error: 'Token e assinatura são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP from headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    console.log(`[contract-sign] Processing signature for token: ${token.substring(0, 8)}...`);
    console.log(`[contract-sign] Client IP: ${clientIp}`);

    // Find contract by token
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, signed_at')
      .eq('signature_token', token)
      .single();

    if (fetchError || !contract) {
      console.error('[contract-sign] Contract not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado ou link inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (contract.signed_at) {
      console.log('[contract-sign] Contract already signed');
      return new Response(
        JSON.stringify({ error: 'Este contrato já foi assinado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update contract with signature
    const signedAt = new Date().toISOString();
    console.log('[contract-sign] Updating contract:', contract.id);
    
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        signature_image: signatureImage,
        signed_at: signedAt,
        signed_ip: clientIp,
        signed_user_agent: userAgent || 'unknown',
        signature_hash: signatureHash,
        status: 'signed',
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('[contract-sign] Error updating contract:', updateError);
      throw updateError;
    }

    // Log the signature event
    console.log('[contract-sign] Inserting signature log');
    await supabase.from('contract_signature_logs').insert({
      contract_id: contract.id,
      action: 'signed',
      ip_address: clientIp,
      user_agent: userAgent || 'unknown',
    });

    console.log(`[contract-sign] Contract ${contract.id} signed successfully`);

    // TODO: Send confirmation via WhatsApp (future enhancement)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Contrato assinado com sucesso',
        signedAt 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[contract-sign] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar assinatura' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
