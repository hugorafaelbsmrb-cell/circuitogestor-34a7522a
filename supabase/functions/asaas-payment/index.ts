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
  interestValue: number;
  fineValue: number;
  discountEnabled: boolean;
  discountValue: number;
  discountDays: number;
  notificationDisabled: boolean;
}

// Create Supabase client to read settings from database
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getAsaasConfig(): Promise<AsaasConfig> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get API key, environment, and penalty settings from database
  const { data: settings, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT", "asaas_interest_value", "asaas_fine_value", "asaas_discount_enabled", "asaas_discount_value", "asaas_discount_days_before", "asaas_notification_disabled"]);
  
  if (error) {
    console.error("Erro ao buscar configurações:", error);
    throw new Error("Erro ao buscar configurações do Asaas");
  }
  
  const apiKey = settings?.find(s => s.key === "ASAAS_API_KEY")?.value;
  const environment = settings?.find(s => s.key === "ASAAS_ENVIRONMENT")?.value || "sandbox";
  const interestValue = parseFloat(settings?.find(s => s.key === "asaas_interest_value")?.value || "1");
  const fineValue = parseFloat(settings?.find(s => s.key === "asaas_fine_value")?.value || "2");
  const discountEnabled = settings?.find(s => s.key === "asaas_discount_enabled")?.value === "true";
  const discountValue = parseFloat(settings?.find(s => s.key === "asaas_discount_value")?.value || "0");
  const discountDays = parseInt(settings?.find(s => s.key === "asaas_discount_days_before")?.value || "0");
  const notificationDisabled = settings?.find(s => s.key === "asaas_notification_disabled")?.value === "true";
  
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada no banco de dados");
  }
  
  const isProduction = environment === "production";
  const baseUrl = isProduction 
    ? "https://www.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
  
  console.log("=== CONFIGURAÇÃO ASAAS ===");
  console.log("Ambiente:", isProduction ? "PRODUÇÃO" : "SANDBOX");
  console.log("URL Base:", baseUrl);
  console.log("API Key configurada:", apiKey ? "Sim" : "Não");
  console.log("Juros:", interestValue + "% | Multa:", fineValue + "%");
  console.log("Desconto:", discountEnabled ? `${discountValue}% até ${discountDays} dias antes` : "Desabilitado");
  console.log("Notificações Asaas para cliente:", notificationDisabled ? "DESABILITADAS" : "Habilitadas");
  console.log("==========================");
  
  return { 
    apiKey, 
    baseUrl, 
    isProduction,
    interestValue,
    fineValue,
    discountEnabled,
    discountValue,
    discountDays,
    notificationDisabled
  };
}

const getHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  "accept": "application/json",
  "access_token": apiKey,
  "user-agent": "Lovable/1.0",
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
  console.log("Notificações desabilitadas:", config.notificationDisabled);
  
  const customerPayload: Record<string, unknown> = {
    name: data.name,
    cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
    email: data.email,
    phone: data.phone.replace(/\D/g, ""),
    address: data.address,
    addressNumber: data.addressNumber,
    province: data.province,
    postalCode: data.postalCode.replace(/\D/g, ""),
  };
  
  // Add notificationDisabled based on system config
  if (config.notificationDisabled) {
    customerPayload.notificationDisabled = true;
    console.log("Cliente será criado com notificações DESABILITADAS");
  }
  
  const response = await fetch(`${config.baseUrl}/customers`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(customerPayload),
  });

  const result = await handleAsaasResponse(response, "createCustomer");
  console.log("Cliente criado com sucesso:", result.id, "| notificationDisabled:", result.notificationDisabled);
  return result;
}

async function updateCustomer(config: AsaasConfig, customerId: string, data: { notificationDisabled?: boolean }) {
  console.log("Atualizando cliente no Asaas:", customerId);
  
  const response = await fetch(`${config.baseUrl}/customers/${customerId}`, {
    method: "PUT",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(data),
  });

  return await handleAsaasResponse(response, "updateCustomer");
}

async function syncAllCustomerNotifications(config: AsaasConfig) {
  console.log("Sincronizando notificações para todos os clientes...");
  console.log("Notificações desabilitadas:", config.notificationDisabled);
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get all guardians with asaas_customer_id
  const { data: guardians, error } = await supabase
    .from("guardians")
    .select("id, name, asaas_customer_id")
    .not("asaas_customer_id", "is", null)
    .neq("asaas_customer_id", "");
  
  if (error) {
    throw new Error("Erro ao buscar responsáveis: " + error.message);
  }
  
  console.log(`Encontrados ${guardians?.length || 0} responsáveis com asaas_customer_id`);
  
  const results = {
    total: guardians?.length || 0,
    updated: 0,
    errors: [] as { name: string; customerId: string; error: string }[],
  };
  
  for (const guardian of guardians || []) {
    try {
      await updateCustomer(config, guardian.asaas_customer_id, {
        notificationDisabled: config.notificationDisabled,
      });
      results.updated++;
      console.log(`Notificações atualizadas para ${guardian.name}: notificationDisabled=${config.notificationDisabled}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`Erro ao atualizar ${guardian.name}:`, errorMsg);
      results.errors.push({ 
        name: guardian.name, 
        customerId: guardian.asaas_customer_id, 
        error: errorMsg 
      });
    }
  }
  
  console.log("Sincronização de notificações concluída:", results);
  return results;
}

interface DiscountConfig {
  value: number;
  dueDateLimitDays: number;
  type: "PERCENTAGE" | "FIXED";
}

// Create a single boleto (for pro-rata first payment)
async function createBoleto(config: AsaasConfig, data: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
  interest?: { value: number };
  fine?: { value: number };
  discount?: DiscountConfig;
}) {
  console.log("Criando boleto avulso no Asaas:", data.value);
  
  const paymentBody: Record<string, unknown> = {
    customer: data.customerId,
    billingType: "BOLETO",
    value: data.value,
    dueDate: data.dueDate,
    description: data.description,
    externalReference: data.externalReference,
    interest: data.interest || { value: config.interestValue },
    fine: data.fine || { value: config.fineValue },
  };
  
  // Use discount from config if not provided in data
  const discountValue = data.discount?.value ?? (config.discountEnabled ? config.discountValue : 0);
  const discountDays = data.discount?.dueDateLimitDays ?? config.discountDays;
  
  if (discountValue > 0 && discountDays > 0) {
    paymentBody.discount = {
      value: discountValue,
      dueDateLimitDays: discountDays,
      type: data.discount?.type || "PERCENTAGE",
    };
    console.log("Desconto por antecipação configurado:", paymentBody.discount);
  }
  
  const response = await fetch(`${config.baseUrl}/payments`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(paymentBody),
  });

  const result = await handleAsaasResponse(response, "createBoleto");
  console.log("Boleto avulso criado com sucesso:", result.id);
  return result;
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
    interest: data.interest || { value: config.interestValue },
    fine: data.fine || { value: config.fineValue },
  };
  
  // Use discount from config if not provided in data
  const discountValue = data.discount?.value ?? (config.discountEnabled ? config.discountValue : 0);
  const discountDays = data.discount?.dueDateLimitDays ?? config.discountDays;
  
  if (discountValue > 0 && discountDays > 0) {
    paymentBody.discount = {
      value: discountValue,
      dueDateLimitDays: discountDays,
      type: data.discount?.type || "PERCENTAGE",
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
  
  // Fetch all payments with pagination
  let allPayments: unknown[] = [];
  let offset = 0;
  const limit = 100; // Max limit per request
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(
      `${config.baseUrl}/installments/${installmentId}/payments?offset=${offset}&limit=${limit}`, 
      {
        method: "GET",
        headers: getHeaders(config.apiKey),
      }
    );

    const result = await handleAsaasResponse(response, "listInstallmentPayments");
    
    if (result.data && Array.isArray(result.data)) {
      allPayments = [...allPayments, ...result.data];
    }
    
    hasMore = result.hasMore === true;
    offset += limit;
    
    // Safety limit to prevent infinite loops
    if (offset > 1000) {
      console.warn("Limite de paginação atingido");
      break;
    }
  }
  
  console.log("Total de parcelas encontradas:", allPayments.length);
  
  return { 
    object: "list",
    hasMore: false,
    totalCount: allPayments.length,
    data: allPayments
  };
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

async function deletePayment(config: AsaasConfig, paymentId: string) {
  console.log("Cancelando/excluindo cobrança:", paymentId);
  
  const response = await fetch(`${config.baseUrl}/payments/${paymentId}`, {
    method: "DELETE",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "deletePayment");
}

async function getPayment(config: AsaasConfig, paymentId: string) {
  console.log("Obtendo detalhes da cobrança:", paymentId);
  
  const response = await fetch(`${config.baseUrl}/payments/${paymentId}`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "getPayment");
}

async function listPayments(config: AsaasConfig, customerId: string) {
  console.log("Listando cobranças do cliente:", customerId);
  
  const response = await fetch(`${config.baseUrl}/payments?customer=${customerId}`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "listPayments");
}

async function searchCustomerByCpf(config: AsaasConfig, cpfCnpj: string) {
  const cleanCpf = cpfCnpj.replace(/\D/g, "");
  console.log("Buscando cliente por CPF:", cleanCpf);
  
  const response = await fetch(`${config.baseUrl}/customers?cpfCnpj=${cleanCpf}`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  const result = await handleAsaasResponse(response, "searchCustomerByCpf");
  
  if (result.data && result.data.length > 0) {
    console.log("Cliente encontrado:", result.data[0].id);
    return result.data[0];
  }
  
  console.log("Nenhum cliente encontrado para o CPF:", cleanCpf);
  return null;
}

async function syncGuardians(config: AsaasConfig) {
  console.log("Iniciando sincronização de responsáveis...");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get all guardians without asaas_customer_id
  const { data: guardians, error } = await supabase
    .from("guardians")
    .select("id, name, cpf, email, phone, address, address_number, province, postal_code")
    .or("asaas_customer_id.is.null,asaas_customer_id.eq.");
  
  if (error) {
    throw new Error("Erro ao buscar responsáveis: " + error.message);
  }
  
  console.log(`Encontrados ${guardians?.length || 0} responsáveis sem asaas_customer_id`);
  
  const results = {
    total: guardians?.length || 0,
    synced: 0,
    created: 0,
    errors: [] as { name: string; error: string }[],
  };
  
  for (const guardian of guardians || []) {
    try {
      // Try to find existing customer by CPF
      const existingCustomer = await searchCustomerByCpf(config, guardian.cpf);
      
      let customerId: string;
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
        results.synced++;
        console.log(`Cliente existente encontrado para ${guardian.name}: ${customerId}`);
      } else {
        // Create new customer
        const newCustomer = await createCustomer(config, {
          name: guardian.name,
          cpfCnpj: guardian.cpf,
          email: guardian.email,
          phone: guardian.phone,
          address: guardian.address,
          addressNumber: guardian.address_number || "S/N",
          province: guardian.province || "Centro",
          postalCode: guardian.postal_code || "00000000",
        });
        customerId = newCustomer.id;
        results.created++;
        console.log(`Novo cliente criado para ${guardian.name}: ${customerId}`);
      }
      
      // Update guardian with asaas_customer_id
      const { error: updateError } = await supabase
        .from("guardians")
        .update({ asaas_customer_id: customerId })
        .eq("id", guardian.id);
      
      if (updateError) {
        throw new Error("Erro ao atualizar guardian: " + updateError.message);
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`Erro ao sincronizar ${guardian.name}:`, errorMsg);
      results.errors.push({ name: guardian.name, error: errorMsg });
    }
  }
  
  console.log("Sincronização concluída:", results);
  return results;
}

async function receiveInCash(config: AsaasConfig, paymentId: string, paymentDate: string, value?: number, notifyCustomer?: boolean) {
  console.log("Registrando pagamento em dinheiro:", paymentId);
  console.log("Parâmetros recebidos - paymentDate:", paymentDate, "value:", value, "notifyCustomer:", notifyCustomer);
  
  // First, get the payment details to check its value and status
  const payment = await getPayment(config, paymentId);
  console.log("Status do pagamento:", payment.status);
  console.log("Valor original:", payment.value);
  console.log("Valor líquido:", payment.netValue);
  console.log("Desconto configurado:", JSON.stringify(payment.discount));
  
  const paymentValue = value ?? payment.value;
  
  console.log("Valor para baixa:", paymentValue);
  
  // Check payment status - can only receive in cash if PENDING or OVERDUE
  if (!['PENDING', 'OVERDUE'].includes(payment.status)) {
    throw new Error(`Não é possível dar baixa em cobrança com status ${payment.status}. Status permitidos: PENDING, OVERDUE`);
  }
  
  // Asaas requires a minimum value of R$ 1.00 for receiveInCash
  if (paymentValue < 1.0) {
    console.log("Valor abaixo do mínimo de R$ 1,00. Cancelando cobrança ao invés de dar baixa.");
    // For payments below R$ 1.00, we cancel the payment instead
    const deleteResult = await deletePayment(config, paymentId);
    return { 
      ...deleteResult, 
      message: "Cobrança cancelada (valor abaixo de R$ 1,00)",
      wasDeleted: true 
    };
  }
  
  // Always include value in the request - Asaas seems to require it
  const body: Record<string, unknown> = {
    paymentDate,
    notifyCustomer: notifyCustomer ?? false,
    value: paymentValue,
  };
  
  console.log("Body da requisição:", JSON.stringify(body));
  
  const response = await fetch(`${config.baseUrl}/payments/${paymentId}/receiveInCash`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  return await handleAsaasResponse(response, "receiveInCash");
}

async function undoReceivedInCash(config: AsaasConfig, paymentId: string) {
  console.log("Desfazendo recebimento em dinheiro:", paymentId);
  
  const response = await fetch(`${config.baseUrl}/payments/${paymentId}/undoReceivedInCash`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "undoReceivedInCash");
}

// Get PIX QR Code for a payment (works for installment payments too)
async function getPixQrCode(config: AsaasConfig, paymentId: string) {
  console.log("Obtendo QR Code PIX para cobrança:", paymentId);
  
  const response = await fetch(`${config.baseUrl}/payments/${paymentId}/pixQrCode`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  const result = await handleAsaasResponse(response, "getPixQrCode");
  
  console.log("QR Code PIX obtido com sucesso");
  console.log("Payload (primeiros 50 chars):", result.payload?.substring(0, 50) + "...");
  console.log("Expiração:", result.expirationDate);
  
  return {
    success: true,
    payload: result.payload, // Código PIX "copia e cola"
    encodedImage: result.encodedImage, // QR Code em base64
    expirationDate: result.expirationDate,
  };
}

// ==================== ANTICIPATION FUNCTIONS ====================

async function simulateAnticipation(config: AsaasConfig, data: { payment?: string; installment?: string }) {
  console.log("Simulando antecipação:", data.payment ? `payment=${data.payment}` : `installment=${data.installment}`);
  
  const body: Record<string, string> = {};
  if (data.payment) body.payment = data.payment;
  if (data.installment) body.installment = data.installment;
  
  const response = await fetch(`${config.baseUrl}/anticipations/simulate`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  const result = await handleAsaasResponse(response, "simulateAnticipation");
  console.log("Simulação concluída - Valor líquido:", result.anticipatedValue, "Taxa:", result.fee);
  return result;
}

async function requestAnticipation(
  config: AsaasConfig,
  data: { payment?: string; installment?: string; contractPdfUrl?: string; documentType?: string }
) {
  console.log(
    "Solicitando antecipação:",
    data.payment ? `payment=${data.payment}` : `installment=${data.installment}`,
    "com contrato:", !!data.contractPdfUrl
  );

  // If we have a signed contract PDF, send via multipart with documents[]
  if (data.contractPdfUrl) {
    console.log("Baixando PDF do contrato:", data.contractPdfUrl);
    const pdfResp = await fetch(data.contractPdfUrl);
    if (!pdfResp.ok) {
      throw new Error(`Falha ao baixar PDF do contrato (status ${pdfResp.status})`);
    }
    const pdfBlob = await pdfResp.blob();
    console.log("PDF baixado, tamanho:", pdfBlob.size);

    const form = new FormData();
    if (data.payment) form.append("payment", data.payment);
    if (data.installment) form.append("installment", data.installment);
    // Asaas accepts the document type field name as 'documentType' (CONTRACT/INVOICE/MEDIA)
    form.append("documentType", data.documentType || "CONTRACT");
    form.append("documentFile", pdfBlob, "contrato-assinado.pdf");

    const response = await fetch(`${config.baseUrl}/anticipations`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "access_token": config.apiKey,
        "user-agent": "Lovable/1.0",
      },
      body: form,
    });

    const result = await handleAsaasResponse(response, "requestAnticipation");
    console.log("Antecipação solicitada (multipart):", result.id, "Status:", result.status);
    return result;
  }

  const body: Record<string, string> = {};
  if (data.payment) body.payment = data.payment;
  if (data.installment) body.installment = data.installment;

  const response = await fetch(`${config.baseUrl}/anticipations`, {
    method: "POST",
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  const result = await handleAsaasResponse(response, "requestAnticipation");
  console.log("Antecipação solicitada:", result.id, "Status:", result.status);
  return result;
}

async function listAnticipations(config: AsaasConfig, filters?: { status?: string; offset?: number; limit?: number }) {
  console.log("Listando antecipações:", filters);
  
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.offset !== undefined) params.append("offset", String(filters.offset));
  if (filters?.limit !== undefined) params.append("limit", String(filters.limit));
  
  const queryString = params.toString();
  const url = `${config.baseUrl}/anticipations${queryString ? `?${queryString}` : ""}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  const result = await handleAsaasResponse(response, "listAnticipations");
  console.log("Antecipações encontradas:", result.data?.length || 0);
  return result;
}

async function getAnticipation(config: AsaasConfig, anticipationId: string) {
  console.log("Obtendo antecipação:", anticipationId);
  
  const response = await fetch(`${config.baseUrl}/anticipations/${anticipationId}`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "getAnticipation");
}

async function getAnticipationLimits(config: AsaasConfig) {
  console.log("Obtendo limites de antecipação");
  
  const response = await fetch(`${config.baseUrl}/anticipations/limits`, {
    method: "GET",
    headers: getHeaders(config.apiKey),
  });

  return await handleAsaasResponse(response, "getAnticipationLimits");
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
      case "createBoleto":
        result = await createBoleto(config, data);
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
      case "undoReceivedInCash":
        result = await undoReceivedInCash(config, data.paymentId);
        break;
      case "deletePayment":
        result = await deletePayment(config, data.paymentId);
        break;
      case "searchCustomerByCpf":
        result = await searchCustomerByCpf(config, data.cpfCnpj);
        break;
      case "syncGuardians":
        result = await syncGuardians(config);
        break;
      case "getPixQrCode":
        result = await getPixQrCode(config, data.paymentId);
        break;
      case "updateCustomer":
        result = await updateCustomer(config, data.customerId, data.updates);
        break;
      case "syncAllCustomerNotifications":
        result = await syncAllCustomerNotifications(config);
        break;
      case "simulateAnticipation":
        result = await simulateAnticipation(config, data);
        break;
      case "requestAnticipation":
        result = await requestAnticipation(config, data);
        break;
      case "listAnticipations":
        result = await listAnticipations(config, data);
        break;
      case "getAnticipation":
        result = await getAnticipation(config, data.anticipationId);
        break;
      case "getAnticipationLimits":
        result = await getAnticipationLimits(config);
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
