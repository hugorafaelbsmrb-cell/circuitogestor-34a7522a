import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// Default to sandbox for safety - set ASAAS_PRODUCTION=true to use production
const ASAAS_API_URL = Deno.env.get("ASAAS_PRODUCTION") === "true" 
  ? "https://api.asaas.com/api/v3"
  : "https://sandbox.asaas.com/api/v3";

const getApiKey = () => {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada");
  }
  return apiKey;
};

const getHeaders = () => ({
  "Content-Type": "application/json",
  "accept": "application/json",
  "access_token": getApiKey(),
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

async function createCustomer(data: CreateCustomerRequest) {
  console.log("Criando cliente no Asaas:", data.name);
  console.log("API URL:", ASAAS_API_URL);
  
  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: "POST",
    headers: getHeaders(),
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

async function createCarne(data: {
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
  let totalValue = data.value;
  
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
  const response = await fetch(`${ASAAS_API_URL}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(paymentBody),
  });

  const result = await handleAsaasResponse(response, "createCarne");
  console.log("Carnê criado com sucesso, installment:", result.installment);
  return result;
}

async function listInstallmentPayments(installmentId: string) {
  console.log("Listando parcelas do carnê:", installmentId);
  
  const response = await fetch(`${ASAAS_API_URL}/installments/${installmentId}/payments`, {
    method: "GET",
    headers: getHeaders(),
  });

  return await handleAsaasResponse(response, "listInstallmentPayments");
}

async function getInstallment(installmentId: string) {
  console.log("Obtendo dados do carnê:", installmentId);
  
  const response = await fetch(`${ASAAS_API_URL}/installments/${installmentId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  return await handleAsaasResponse(response, "getInstallment");
}

async function deleteInstallment(installmentId: string) {
  console.log("Excluindo carnê:", installmentId);
  
  const response = await fetch(`${ASAAS_API_URL}/installments/${installmentId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return await handleAsaasResponse(response, "deleteInstallment");
}

async function refundInstallment(installmentId: string) {
  console.log("Estornando carnê:", installmentId);
  
  const response = await fetch(`${ASAAS_API_URL}/installments/${installmentId}/refund`, {
    method: "POST",
    headers: getHeaders(),
  });

  return await handleAsaasResponse(response, "refundInstallment");
}

async function getInstallmentBooklet(installmentId: string) {
  console.log("Obtendo carnê em PDF:", installmentId);
  
  const response = await fetch(`${ASAAS_API_URL}/installments/${installmentId}/paymentBook`, {
    method: "GET",
    headers: getHeaders(),
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

async function listPayments(customerId: string) {
  console.log("Listando cobranças do cliente:", customerId);
  
  const response = await fetch(`${ASAAS_API_URL}/payments?customer=${customerId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  return await handleAsaasResponse(response, "listPayments");
}

async function receiveInCash(paymentId: string, paymentDate: string, value?: number, notifyCustomer?: boolean) {
  console.log("Registrando pagamento em dinheiro:", paymentId);
  
  const body: Record<string, unknown> = {
    paymentDate,
    notifyCustomer: notifyCustomer ?? false,
  };
  
  if (value) {
    body.value = value;
  }
  
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/receiveInCash`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  return await handleAsaasResponse(response, "receiveInCash");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log("Ação recebida:", action);
    console.log("Ambiente Asaas:", Deno.env.get("ASAAS_PRODUCTION") === "true" ? "Produção" : "Sandbox");

    let result;

    switch (action) {
      case "createCustomer":
        result = await createCustomer(data);
        break;
      case "createCarne":
        result = await createCarne(data);
        break;
      case "listPayments":
        result = await listPayments(data.customerId);
        break;
      case "listInstallmentPayments":
        result = await listInstallmentPayments(data.installmentId);
        break;
      case "getInstallment":
        result = await getInstallment(data.installmentId);
        break;
      case "deleteInstallment":
        result = await deleteInstallment(data.installmentId);
        break;
      case "refundInstallment":
        result = await refundInstallment(data.installmentId);
        break;
      case "getInstallmentBooklet":
        result = await getInstallmentBooklet(data.installmentId);
        break;
      case "receiveInCash":
        result = await receiveInCash(data.paymentId, data.paymentDate, data.value, data.notifyCustomer);
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
