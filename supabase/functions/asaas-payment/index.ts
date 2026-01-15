import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCustomerRequest {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
}

interface AsaasConfig {
  apiKey: string;
  baseUrl: string;
  isProduction: boolean;
}

// Create Supabase client to read settings from database
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getAsaasConfig(): Promise<AsaasConfig> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get API key and environment from database
  const { data: settings, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"]);
  
  if (error) {
    console.error("Erro ao buscar configurações:", error);
    throw new Error("Erro ao buscar configurações do Asaas");
  }
  
  const apiKey = settings?.find(s => s.key === "ASAAS_API_KEY")?.value;
  const environment = settings?.find(s => s.key === "ASAAS_ENVIRONMENT")?.value || "sandbox";
  
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada no banco de dados");
  }
  
  const isProduction = environment === "production";
  const baseUrl = isProduction 
    ? "https://api.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
  
  console.log("=== CONFIGURAÇÃO ASAAS ===");
  console.log("Ambiente:", isProduction ? "PRODUÇÃO" : "SANDBOX");
  console.log("URL Base:", baseUrl);
  console.log("API Key (primeiros 20 chars):", apiKey.substring(0, 20) + "...");
  console.log("==========================");
  
  return { apiKey, baseUrl, isProduction };
}

const getHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  "accept": "application/json",
  "access_token": apiKey,
});

async function handleAsaasResponse(response: Response, operation: string) {
  const text = await response.text();
  
  console.log(`Asaas ${operation} response status:`, response.status);
  console.log(`Asaas ${operation} response body:`, text.substring(0, 500));
  
  // Check if response is HTML (error page)
  if (text.startsWith("<!") || text.startsWith("<html")) {
    throw new Error(`Erro de autenticação ou URL inválida. Verifique sua chave API Asaas. Status: ${response.status}`);
  }
  
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida da API Asaas: ${text.substring(0, 200)}`);
  }
  
  if (!response.ok) {
    const errorMsg = result.errors?.[0]?.description || result.message || `Erro na operação ${operation}`;
    throw new Error(errorMsg);
  }
  
  return result;
}

async function createCustomer(config: AsaasConfig, data: CreateCustomerRequest) {
  console.log("Criando cliente no Asaas:", data.name);
  
  const response = await fetch(`${config.baseUrl}/customers`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify({
      name: data.name,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
      email: data.email,
      phone: data.phone.replace(/\D/g, ""),
      address: data.address,
      addressNumber: data.addressNumber,
      province: data.province,
      postalCode: data.postalCode.replace(/\D/g, ""),
    }),
  });

  const result = await handleAsaasResponse(response, "createCustomer");
  console.log("Cliente criado com sucesso:", result.id);
  return result;
}

interface DiscountConfig {
  value: number;
  dueDateLimitDays: number;
  type: "PERCENTAGE" | "FIXED";
}

async function createCarne(config: AsaasConfig, data: {
  customerId: string;
  value: number;
  installmentCount: number;
  dueDate: string;
  description: string;
  externalReference?: string;
  interest?: { value: number };
  fine?: { value: number };
  discount?: DiscountConfig;
  firstInstallmentValue?: number;
}) {
  console.log("Criando carnê no Asaas:", data.installmentCount, "parcelas");
  
  // Calculate installment value - if firstInstallmentValue is provided, it's pro-rata
  let installmentValue: number;
  const totalValue = data.value;
  
  if (data.firstInstallmentValue && data.firstInstallmentValue !== (data.value / data.installmentCount)) {
    // Pro-rata: first installment has different value
    // Recalculate regular installment value for remaining payments
    const remainingValue = totalValue - data.firstInstallmentValue;
    const remainingInstallments = data.installmentCount - 1;
    installmentValue = remainingInstallments > 0 
      ? Math.ceil((remainingValue / remainingInstallments) * 100) / 100
      : data.firstInstallmentValue;
    
    console.log("Pro-rata configurado - 1ª parcela:", data.firstInstallmentValue, "Demais:", installmentValue);
  } else {
    // Standard: all installments equal
    installmentValue = Math.ceil((data.value / data.installmentCount) * 100) / 100;
  }
  
  // Build payment body - use firstInstallmentValue as the value for first payment
  const paymentBody: Record<string, unknown> = {
    customer: data.customerId,
    billingType: "BOLETO",
    value: data.firstInstallmentValue || installmentValue,
    dueDate: data.dueDate,
    description: data.description,
    externalReference: data.externalReference,
    installmentCount: data.installmentCount,
    installmentValue: installmentValue,
    interest: data.interest || { value: 1 }, // 1% de juros ao mês por padrão
    fine: data.fine || { value: 2 }, // 2% de multa por padrão
  };
  
  // Add discount if configured - this adds discount text to the boleto
  if (data.discount && data.discount.value > 0 && data.discount.dueDateLimitDays > 0) {
    paymentBody.discount = {
      value: data.discount.value,
      dueDateLimitDays: data.discount.dueDateLimitDays,
      type: data.discount.type || "PERCENTAGE",
    };
    console.log("Desconto por antecipação configurado:", paymentBody.discount);
  }
  
  // Asaas uses the /payments endpoint with installmentCount for carnê
  const response = await fetch(`${config.baseUrl}/payments`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(paymentBody),
  });

  const result = await handleAsaasResponse(response, "createCarne");
  console.log("Carnê criado com sucesso, installment:", result.installment);
  return result;
}

async function listInstallmentPayments(config: AsaasConfig, installmentId: string) {
  console.log("Listando parcelas do carnê:", installmentId);
  
  const response = await fetch(`${config.baseUrl}/installments/${installmentId}/payments`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "listInstallmentPayments");
}

async function getInstallment(config: AsaasConfig, installmentId: string) {
  console.log("Obtendo dados do carnê:", installmentId);
  
  const response = await fetch(`${config.baseUrl}/installments/${installmentId}`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "getInstallment");
}

async function deleteInstallment(config: AsaasConfig, installmentId: string) {
  console.log("Excluindo carnê:", installmentId);
  
  const response = await fetch(`${config.baseUrl}/installments/${installmentId}`, {
    method: "DELETE",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "deleteInstallment");
}

async function refundInstallment(config: AsaasConfig, installmentId: string) {
  console.log("Estornando carnê:", installmentId);
  
  const response = await fetch(`${config.baseUrl}/installments/${installmentId}/refund`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "refundInstallment");
}

async function getInstallmentBooklet(config: AsaasConfig, installmentId: string) {
  console.log("Obtendo carnê em PDF:", installmentId);
  
  const response = await fetch(`${config.baseUrl}/installments/${installmentId}/paymentBook`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  // This endpoint returns PDF directly, not JSON
  if (!response.ok) {
    const text = await response.text();
    console.error("Erro ao obter carnê:", text.substring(0, 500));
    throw new Error(`Erro ao obter carnê: ${text.substring(0, 200)}`);
  }
  
  // Get PDF as ArrayBuffer and convert to base64
  const pdfBuffer = await response.arrayBuffer();
  const pdfBytes = new Uint8Array(pdfBuffer);
  
  // Convert to base64
  let binary = '';
  for (let i = 0; i < pdfBytes.byteLength; i++) {
    binary += String.fromCharCode(pdfBytes[i]);
  }
  const base64Pdf = btoa(binary);
  
  console.log("Carnê PDF obtido com sucesso, tamanho:", pdfBytes.byteLength, "bytes");
  
  return { 
    success: true, 
    pdfBase64: base64Pdf,
    contentType: "application/pdf",
    message: "Carnê obtido com sucesso"
  };
}

async function listPayments(config: AsaasConfig, customerId: string) {
  console.log("Listando cobranças do cliente:", customerId);
  
  const response = await fetch(`${config.baseUrl}/payments?customer=${customerId}`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "listPayments");
}

async function receiveInCash(config: AsaasConfig, paymentId: string, paymentDate: string, value?: number, notifyCustomer?: boolean) {
  console.log("Registrando pagamento em dinheiro:", paymentId);
  
  const body: Record<string, unknown> = {
    paymentDate,
    notifyCustomer: notifyCustomer ?? false,
  };
  
  if (value) {
    body.value = value;
  }
  
  const response = await fetch(`${config.baseUrl}/payments/${paymentId}/receiveInCash`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  return await handleAsaasResponse(response, "receiveInCash");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Asaas config from database for each request
    const config = await getAsaasConfig();
    
    const { action, data } = await req.json();
    console.log("Ação recebida:", action);

    let result;

    switch (action) {
      case "createCustomer":
        result = await createCustomer(config, data);
        break;
      case "createCarne":
        result = await createCarne(config, data);
        break;
      case "listPayments":
        result = await listPayments(config, data.customerId);
        break;
      case "listInstallmentPayments":
        result = await listInstallmentPayments(config, data.installmentId);
        break;
      case "getInstallment":
        result = await getInstallment(config, data.installmentId);
        break;
      case "deleteInstallment":
        result = await deleteInstallment(config, data.installmentId);
        break;
      case "refundInstallment":
        result = await refundInstallment(config, data.installmentId);
        break;
      case "getInstallmentBooklet":
        result = await getInstallmentBooklet(config, data.installmentId);
        break;
      case "receiveInCash":
        result = await receiveInCash(config, data.paymentId, data.paymentDate, data.value, data.notifyCustomer);
        break;
      default:
        throw new Error("Ação não reconhecida");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro na função:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
