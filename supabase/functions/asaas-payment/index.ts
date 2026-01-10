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

interface CreatePaymentRequest {
  customerId: string;
  billingType: "BOLETO";
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
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

async function createPayment(data: CreatePaymentRequest) {
  console.log("Criando cobrança no Asaas:", data.description);
  
  const response = await fetch(`${ASAAS_API_URL}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      customer: data.customerId,
      billingType: data.billingType,
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.externalReference,
      installmentCount: data.installmentCount,
      installmentValue: data.installmentValue,
    }),
  });

  const result = await handleAsaasResponse(response, "createPayment");
  console.log("Cobrança criada com sucesso:", result.id);
  return result;
}

async function getPaymentBoleto(paymentId: string) {
  console.log("Obtendo boleto:", paymentId);
  
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/identificationField`, {
    method: "GET",
    headers: getHeaders(),
  });

  return await handleAsaasResponse(response, "getBoleto");
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
}) {
  console.log("Criando carnê no Asaas:", data.installmentCount, "parcelas");
  
  const installmentValue = Math.ceil((data.value / data.installmentCount) * 100) / 100;
  
  // Asaas uses the /payments endpoint with installmentCount for carnê
  const response = await fetch(`${ASAAS_API_URL}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      customer: data.customerId,
      billingType: "BOLETO",
      value: installmentValue,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.externalReference,
      installmentCount: data.installmentCount,
      installmentValue: installmentValue,
      interest: data.interest || { value: 1 }, // 1% de juros ao mês por padrão
      fine: data.fine || { value: 2 }, // 2% de multa por padrão
    }),
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
    throw new Error(`Erro ao obter carnê: ${text.substring(0, 200)}`);
  }
  
  // Return the URL for the payment book
  return { 
    success: true, 
    url: `${ASAAS_API_URL}/installments/${installmentId}/paymentBook`,
    message: "Use o link para baixar o carnê em PDF"
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
      case "createPayment":
        result = await createPayment(data);
        break;
      case "createCarne":
        result = await createCarne(data);
        break;
      case "getBoleto":
        result = await getPaymentBoleto(data.paymentId);
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
