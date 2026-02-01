

# Plano: Sistema de Controle de Dispositivos Inteligentes (Tomadas e Lâmpadas)

## Visão Geral

Implementar um módulo de automação IoT que permita:
1. **Listar dispositivos** (lâmpadas e tomadas inteligentes)
2. **Controlar dispositivos** (ligar/desligar individualmente ou em grupo)
3. **Agendar automações** (programar horários de funcionamento)
4. **Monitorar consumo** (quando suportado pelo dispositivo)

---

## Análise das Opções Disponíveis

### Opção 1: Tuya Cloud API (Recomendada)

**Vantagens:**
- Maior ecossistema de dispositivos compatíveis no mercado brasileiro
- Lâmpadas e tomadas muito acessíveis (a partir de R$ 25-50)
- API Cloud bem documentada e gratuita para uso pessoal/comercial pequeno
- Suporte a agendamentos nativos na plataforma

**Desvantagens:**
- Requer assinatura HMAC-SHA256 em cada requisição (complexidade média)
- Dependência de internet para funcionar

**Dispositivos compatíveis:** Qualquer dispositivo "Smart Life" ou "Tuya" (milhares de marcas)

---

### Opção 2: Shelly (Alternativa Premium)

**Vantagens:**
- API REST simples, sem autenticação complexa para uso local
- Dispositivos de alta qualidade, fabricação europeia
- Funciona localmente (sem internet) E via cloud
- Excelente para instalações elétricas profissionais

**Desvantagens:**
- Dispositivos mais caros (R$ 100-250 cada)
- Menos variedade no Brasil

---

### Opção 3: Home Assistant (Hub Central)

**Vantagens:**
- Integra Tuya, Shelly, e centenas de outras marcas
- Controle 100% local após configuração
- Interface web completa já pronta
- Open source

**Desvantagens:**
- Requer servidor dedicado (Raspberry Pi ou similar)
- Curva de aprendizado maior
- Manutenção técnica necessária

---

## Recomendação

**Tuya Cloud API** é a melhor opção para sua escola porque:
1. Custo-benefício excelente (dispositivos baratos e amplamente disponíveis)
2. Não precisa de hardware adicional (hub)
3. Pode ser integrado diretamente ao sistema existente
4. Funcionalidade de agendamento nativa

---

## Arquitetura Proposta (Tuya)

```text
┌─────────────────────────────────────────────────────────────────┐
│                 ARQUITETURA IoT - TUYA CLOUD                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │  Lâmpadas   │     │   Tomadas   │     │ Outros Devices  │   │
│  │  Smart Life │     │  Smart Life │     │   Compatíveis   │   │
│  └──────┬──────┘     └──────┬──────┘     └───────┬─────────┘   │
│         │                   │                     │             │
│         └───────────────────┼─────────────────────┘             │
│                             ▼                                   │
│                    ┌────────────────┐                          │
│                    │   Tuya Cloud   │                          │
│                    │   (API REST)   │                          │
│                    └────────┬───────┘                          │
│                             │                                   │
│                             ▼                                   │
│                    ┌────────────────┐                          │
│                    │ Edge Function  │                          │
│                    │  tuya-control  │                          │
│                    └────────┬───────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐              │
│         ▼                   ▼                   ▼              │
│  ┌─────────────┐   ┌─────────────────┐  ┌──────────────┐       │
│  │  Listar     │   │  Controlar      │  │  Agendar     │       │
│  │  Devices    │   │  Liga/Desliga   │  │  Automações  │       │
│  └─────────────┘   └─────────────────┘  └──────────────┘       │
│                                                                 │
│                    ┌────────────────┐                          │
│                    │  Nova Página   │                          │
│                    │  /automacao    │                          │
│                    └────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Implementar

### 1. Credenciais Tuya Necessárias

O usuário precisará criar uma conta gratuita no [Tuya IoT Platform](https://iot.tuya.com) e obter:

| Credencial | Descrição |
|------------|-----------|
| `TUYA_CLIENT_ID` | Access ID do projeto IoT |
| `TUYA_CLIENT_SECRET` | Access Secret do projeto |
| `TUYA_API_ENDPOINT` | URL da região (ex: `https://openapi.tuyaus.com`) |

### 2. Banco de Dados

**Nova tabela: `iot_devices`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Identificador interno |
| tuya_device_id | TEXT | ID do dispositivo na Tuya |
| name | TEXT | Nome amigável (ex: "Luz Sala 1") |
| category | TEXT | Categoria (lamp, socket, switch) |
| room | TEXT | Cômodo/Local (Sala 1, Corredor) |
| is_online | BOOLEAN | Status de conexão |
| last_status | JSONB | Último estado conhecido |
| last_sync_at | TIMESTAMP | Última sincronização |

**Nova tabela: `iot_schedules`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Identificador |
| device_id | UUID | Referência ao dispositivo |
| action | TEXT | 'turn_on' ou 'turn_off' |
| time | TIME | Horário de execução |
| days_of_week | INTEGER[] | Dias (1=Seg, 7=Dom) |
| is_active | BOOLEAN | Agendamento ativo |

### 3. Edge Functions

| Função | Descrição |
|--------|-----------|
| `tuya-auth` | Obtém token de acesso (expira em 2h) |
| `tuya-devices` | Lista/sincroniza dispositivos |
| `tuya-control` | Envia comandos (ligar/desligar) |
| `tuya-schedules` | Gerencia agendamentos |

### 4. Interface

**Nova página: `/automacao`**

- **Aba Dispositivos**: Lista todos os dispositivos com toggle para ligar/desligar
- **Aba Salas**: Agrupa dispositivos por local com controle em grupo
- **Aba Agendamentos**: Cria e gerencia horários automáticos
- **Aba Configurações**: Credenciais Tuya e sincronização

---

## Fluxo de Implementação

### Passo 1: Configuração Inicial
1. Usuário cria conta no Tuya IoT Platform
2. Cria um projeto e obtém Client ID e Secret
3. Vincula dispositivos via app Smart Life
4. Insere credenciais no sistema

### Passo 2: Sincronização
1. Sistema busca lista de dispositivos via API
2. Armazena no banco de dados local
3. Atualiza status periodicamente

### Passo 3: Controle
1. Usuário clica para ligar/desligar
2. Sistema envia comando via Edge Function
3. Atualiza interface em tempo real

### Passo 4: Agendamentos
1. Usuário define horário e ação
2. Sistema usa cron job ou Tuya Timer API
3. Dispositivo executa automaticamente

---

## Interface Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│  Automação IoT                                [+ Sincronizar]  │
├─────────────────────────────────────────────────────────────────┤
│  [Dispositivos] [Por Sala] [Agendamentos] [Config]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ 💡 Luz Sala 1      │  │ 💡 Luz Corredor    │                │
│  │ Status: Ligada     │  │ Status: Desligada  │                │
│  │ [====○====] ON     │  │ [○=========] OFF   │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ 🔌 Tomada Lab 1    │  │ 🔌 Tomada Lab 2    │                │
│  │ Status: Ligada     │  │ Status: Offline    │                │
│  │ [====○====] ON     │  │ [  Indisponível  ] │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                 │
│  ── Controle Rápido ────────────────────────────               │
│  [Desligar Tudo]  [Ligar Sala 1]  [Modo Economia]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Assinatura Tuya API (HMAC-SHA256)

A API Tuya requer assinatura em cada requisição:

```typescript
// Pseudocódigo da assinatura
const timestamp = Date.now().toString();
const nonce = crypto.randomUUID();
const stringToSign = `${clientId}${accessToken}${timestamp}${nonce}${method}\n${contentSha256}\n${headers}\n${url}`;
const signature = hmacSha256(stringToSign, clientSecret).toUpperCase();
```

### Comandos de Controle

```typescript
// Ligar lâmpada
await fetch(`${TUYA_ENDPOINT}/v1.0/devices/${deviceId}/commands`, {
  method: 'POST',
  body: JSON.stringify({
    commands: [{ code: 'switch_led', value: true }]
  })
});

// Desligar tomada
await fetch(`${TUYA_ENDPOINT}/v1.0/devices/${deviceId}/commands`, {
  method: 'POST',
  body: JSON.stringify({
    commands: [{ code: 'switch_1', value: false }]
  })
});
```

---

## Requisitos para Começar

1. **Conta Tuya IoT Platform** (gratuita)
   - Acesse: https://iot.tuya.com
   - Crie um projeto "Smart Home"
   - Vincule sua conta do app Smart Life

2. **Dispositivos Compatíveis**
   - Qualquer lâmpada/tomada com selo "Works with Tuya" ou "Smart Life"
   - Recomendação: Lâmpadas WiFi 9W (~R$ 30) e Tomadas WiFi 10A (~R$ 40)

3. **Rede WiFi 2.4GHz**
   - A maioria dos dispositivos IoT só funciona em 2.4GHz

---

## Sidebar

Novo item no menu (seção "Relatórios e Gestão"):
- Ícone: `Lightbulb` ou `Power`
- Label: "Automação"
- Path: `/automacao`

---

## Resumo de Entregáveis

1. Tabelas `iot_devices` e `iot_schedules`
2. Edge Functions para autenticação e controle Tuya
3. Página `/automacao` com interface completa
4. Card de configuração em Settings para credenciais
5. Funcionalidade de agendamentos
6. Controle em grupo por sala

---

## Alternativas Futuras

Se você preferir não depender de cloud externo, podemos avaliar:

- **Shelly**: Dispositivos com API local (mais caros, mas independentes)
- **Home Assistant**: Hub central open source (requer Raspberry Pi)
- **ESP32 DIY**: Construir seus próprios dispositivos (complexo, mas totalmente customizável)

