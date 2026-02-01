
# Plano: Cliente de Email Integrado ao Sistema

## Visao Geral

Criar um modulo de email completo que permite:
1. **Configurar credenciais IMAP/SMTP** de qualquer provedor de email
2. **Ler emails recebidos** da caixa de entrada
3. **Enviar emails** para qualquer destinatario
4. **Gerenciar conversas** de forma organizada

Isso sera util para comunicacao com parceiros, contador, fornecedores, etc., sem vinculo com os contatos de alunos/responsaveis.

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DO CLIENTE DE EMAIL                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Configuracao (Pagina Settings)                              │
│     - Host IMAP, porta, usuario, senha                          │
│     - Host SMTP, porta, usuario, senha                          │
│     - Email remetente (From)                                    │
│         ↓                                                       │
│  2. Armazenamento (Supabase Secrets / app_settings)             │
│     - Credenciais salvas de forma segura                        │
│         ↓                                                       │
│  3. Edge Functions                                              │
│     - email-fetch: Le emails via IMAP                           │
│     - email-send: Envia emails via SMTP                         │
│         ↓                                                       │
│  4. Interface (Nova Pagina /email)                              │
│     - Lista de emails recebidos                                 │
│     - Visualizador de email                                     │
│     - Compositor de novo email                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Criar

### Banco de Dados

**Nova tabela: `email_messages`** (cache local dos emails)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Identificador unico |
| message_id | TEXT | ID unico do email (IMAP) |
| from_address | TEXT | Remetente |
| to_addresses | TEXT[] | Destinatarios |
| subject | TEXT | Assunto |
| body_text | TEXT | Corpo em texto plano |
| body_html | TEXT | Corpo em HTML |
| received_at | TIMESTAMP | Data de recebimento |
| is_read | BOOLEAN | Lido/nao lido |
| folder | TEXT | Pasta (INBOX, SENT, etc) |
| direction | TEXT | 'inbound' ou 'outbound' |

### Edge Functions

| Funcao | Descricao |
|--------|-----------|
| `email-fetch` | Conecta via IMAP, busca emails novos e salva no banco |
| `email-send` | Envia email via SMTP e registra no historico |
| `email-config-test` | Testa conexao IMAP/SMTP antes de salvar |

### Paginas e Componentes

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/EmailClient.tsx` | Pagina principal do cliente de email |
| `src/components/email/EmailList.tsx` | Lista de emails |
| `src/components/email/EmailViewer.tsx` | Visualizador de email selecionado |
| `src/components/email/EmailComposer.tsx` | Modal para compor novo email |
| `src/components/settings/EmailConfigCard.tsx` | Card de configuracao IMAP/SMTP |

### Sidebar

Adicionar novo item no menu principal:
- Icone: `Mail`
- Label: "E-mail"
- Path: `/email`

---

## Configuracoes Necessarias

O usuario precisara fornecer as seguintes informacoes:

### IMAP (Leitura)
- Servidor IMAP (ex: `imap.gmail.com`, `imap.hostinger.com`)
- Porta (ex: 993 para SSL)
- Usuario (email completo)
- Senha (ou App Password para Gmail)

### SMTP (Envio)
- Servidor SMTP (ex: `smtp.gmail.com`, `smtp.hostinger.com`)
- Porta (ex: 465 para SSL ou 587 para TLS)
- Usuario (email completo)
- Senha
- Email remetente (From)

---

## Bibliotecas Utilizadas

### Para Edge Functions (Deno)
- **ImapFlow** via npm: - Leitura de emails IMAP
- **Nodemailer** via npm: - Envio de emails SMTP

Exemplo de import no Deno:
```typescript
import { ImapFlow } from "npm:imapflow@1.0.183";
import nodemailer from "npm:nodemailer@6.9.8";
```

---

## Interface do Cliente de Email

### Layout Principal (`/email`)

```text
┌──────────────────────────────────────────────────────────────┐
│  [+ Novo Email]                              [Atualizar]     │
├───────────────────┬──────────────────────────────────────────┤
│  Caixa de Entrada │  De: contador@empresa.com                │
│  > Email 1        │  Assunto: Nota Fiscal Dezembro           │
│    Email 2        │  Data: 01/02/2026 14:30                  │
│    Email 3        │  ─────────────────────────────────────── │
│                   │                                          │
│  Enviados         │  Ola,                                    │
│    Email 4        │                                          │
│                   │  Segue em anexo a nota fiscal...         │
│                   │                                          │
│                   │  Atenciosamente,                         │
│                   │  Contador                                │
│                   │                                          │
│                   │  [Responder] [Encaminhar] [Arquivar]     │
└───────────────────┴──────────────────────────────────────────┘
```

### Compositor de Email

```text
┌────────────────────────────────────────────────────────────────┐
│  Novo Email                                              [X]   │
├────────────────────────────────────────────────────────────────┤
│  Para:    [                                        ]           │
│  Assunto: [                                        ]           │
│  ──────────────────────────────────────────────────────────────│
│  |                                                   |         │
│  |  Digite sua mensagem aqui...                      |         │
│  |                                                   |         │
│  |                                                   |         │
│  |                                                   |         │
│  ──────────────────────────────────────────────────────────────│
│                                    [Cancelar] [Enviar]         │
└────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Configuracao

1. Usuario acessa **Configuracoes > E-mail**
2. Preenche credenciais IMAP e SMTP
3. Clica em "Testar Conexao" para validar
4. Credenciais sao salvas de forma segura
5. Usuario acessa `/email` para usar o cliente

---

## Consideracoes de Seguranca

- Credenciais IMAP/SMTP serao armazenadas como secrets no backend
- Edge functions acessam credenciais via `Deno.env.get()`
- Emails sao cacheados localmente para performance
- RLS garante que apenas usuarios autenticados acessem

---

## Limitacoes e Alternativas

### Limitacao: Complexidade IMAP
A integracao IMAP em Edge Functions pode ter limitacoes de timeout para caixas de entrada muito grandes.

### Alternativa Recomendada: API de Email
Se voce usa **Gmail** ou **Outlook**, podemos usar APIs oficiais:
- **Gmail API** - mais confiavel, suporta OAuth
- **Microsoft Graph API** - para Outlook/365

Essas APIs sao mais robustas que IMAP puro, mas exigem configuracao de OAuth.

---

## Resumo de Entregaveis

1. Tabela `email_messages` para cache de emails
2. Edge function `email-fetch` para leitura IMAP
3. Edge function `email-send` para envio SMTP
4. Card de configuracao em Settings
5. Pagina `/email` com cliente completo
6. Item no sidebar para acesso rapido

---

## Proximos Passos

Antes de implementar, preciso confirmar:

**Qual provedor de email voce usa?**
- Se for Gmail, recomendo usar a Gmail API (mais estavel)
- Se for Hostinger, Locaweb ou similar, usaremos IMAP/SMTP
- Se for Outlook/365, podemos usar Microsoft Graph API

Isso vai definir a melhor abordagem tecnica para sua integracao.
