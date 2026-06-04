
# Colônia de Férias — Landing + Checkout + Gestão

Vou criar uma nova landing pública dedicada à Colônia de Férias de Julho, totalmente personalizável pelo admin (textos, imagens, programação, pacotes e formas de pagamento), com checkout integrado ao Asaas e uma área administrativa para gerenciar os inscritos confirmados.

## 1. Estrutura de dados (novas tabelas)

**`vacation_camps`** — uma edição da colônia (permite ter Julho/2026, Janeiro/2027, etc.)
- name, slug (URL pública), description, status (rascunho/publicada/encerrada)
- hero_title, hero_subtitle, hero_image_url, gallery (jsonb), highlights (jsonb)
- start_date, end_date, location, age_min, age_max
- theme_color, cta_text, whatsapp_number
- terms_text (regras/política)

**`vacation_camp_packages`** — pacotes configuráveis (ex: Semana 1, Semana 2, Integral)
- camp_id, name, description, price, original_price (riscado opcional)
- max_slots, sold_count, sort_order, active
- payment_methods (jsonb: pix, boleto, credit_card)
- max_installments (para cartão), due_days (vencimento boleto/pix)

**`vacation_camp_schedule`** — programação editável
- camp_id, day_label (ex: "Segunda 08/07"), time_label (ex: "09h"), title, description, icon, sort_order

**`vacation_camp_enrollments`** — inscritos
- camp_id, package_id
- guardian_name, guardian_phone, guardian_email, guardian_cpf
- child_name, child_age, child_birthdate (opcional), notes
- source ('landing' | 'admin'), linked_student_id (FK opcional para students)
- payment_status (pending/confirmed/overdue/cancelled)
- asaas_payment_id, asaas_invoice_url, asaas_pix_payload, asaas_customer_id
- amount, payment_method, installments
- confirmed_at

RLS: leitura pública apenas de `vacation_camps` publicadas, packages e schedule (para renderizar landing). Enrollments só admin lê; insert público vai pela edge function. Tudo o resto = admin only.

## 2. Landing pública `/colonia/:slug`

Página moderna, mobile-first, dark-aware, animada:

- **Hero** — imagem grande, título, subtítulo, datas, faixa etária, CTA "Garantir vaga"
- **Highlights** — 3-4 cards com ícones (ex: "Piscina", "Recreação", "Lanche incluso")
- **Programação** — timeline visual agrupada por dia, com horário + atividade + ícone. Renderiza dinamicamente o que o admin cadastrou.
- **Galeria** — grid de fotos
- **Pacotes** — cards lado a lado com preço, o que inclui, vagas restantes, botão "Quero esse"
- **Formulário de inscrição (checkout)** — modal/seção:
  - Nome do responsável, telefone, e-mail, CPF
  - Nome completo da criança, idade
  - Pacote escolhido
  - Forma de pagamento (apenas as habilitadas no pacote)
  - Parcelas (se cartão)
  - Botão "Finalizar inscrição"
- **FAQ + regras**
- **Footer** com WhatsApp

Após submit: chama edge function → cria cobrança no Asaas → redireciona para tela de confirmação mostrando QR Code PIX, link do boleto ou checkout transparente do cartão.

## 3. Checkout via Asaas (edge functions)

**`vacation-camp-checkout`** (público, sem JWT)
- Valida payload com Zod
- Valida CPF (validators.ts)
- Normaliza telefone W-API
- Cria/recupera cliente Asaas (reutiliza padrão já existente em `asaas-customer-sync`)
- Cria cobrança conforme método escolhido (PIX → busca QR Code; BOLETO → retorna invoiceUrl; CREDIT_CARD → retorna link de checkout Asaas)
- Insere enrollment com status `pending` e dados do Asaas
- Retorna ao frontend a info de pagamento

**`asaas-webhook`** (já existe) — adicionar handler para confirmar `vacation_camp_enrollments` quando `externalReference` começar com `camp_`, atualizar status, incrementar `sold_count` do pacote, disparar mensagem WhatsApp de boas-vindas via W-API.

## 4. Admin — novas páginas

**`/colonia-admin`** (lista de edições)
- Listar todas as edições, criar nova, duplicar, publicar/despublicar
- Link público copiável (`/colonia/<slug>`)

**`/colonia-admin/:id`** (editor da edição) — abas:
1. **Geral** — nome, slug, datas, idade, descrição, cores
2. **Hero & Imagens** — upload de hero e galeria (bucket novo `camp-images`)
3. **Programação** — CRUD drag-and-drop (dia, horário, atividade, ícone)
4. **Pacotes** — CRUD com preço, vagas, métodos de pagamento, parcelas
5. **Textos** — highlights, FAQ, regras
6. **Inscritos** — tabela com filtros (pacote, status pagamento, origem)
   - Colunas: criança, idade, responsável, telefone, pacote, valor, status, origem
   - Ações: ver detalhes, marcar pago manual, cancelar, enviar WhatsApp, exportar CSV
   - Botão **"Adicionar aluno nosso"** → modal que busca em `students` por nome/CPF, escolhe pacote, cria enrollment com `source='admin'` e `linked_student_id` (sem cobrança, ou com cobrança opcional via Asaas marcando checkbox)

## 5. Integrações com o que já existe

- **Asaas**: reutiliza `ASAAS_API_KEY`, padrão de webhook (`ASAAS_WEBHOOK_SECRET`), `asaas_customer_id` em guardians quando o responsável já existe.
- **W-API**: confirmação de inscrição via WhatsApp usando template configurável.
- **Validators**: CPF, email, telefone vêm de `src/utils/validators.ts`.
- **Storage**: novo bucket público `camp-images` para hero/galeria.
- **Sidebar**: novo item de menu "Colônia de Férias" (admin) protegido por `usePermissionGuard`.
- **Roteamento**: `/colonia/:slug` público em `App.tsx` (antes das rotas protegidas).

## 6. Detalhes técnicos

- Slug único, gerado a partir do nome (`colonia-julho-2026`).
- Programação suporta ícones do `lucide-react` selecionáveis no admin.
- Vagas: `sold_count` incrementado só após confirmação de pagamento (PIX/Boleto) ou na hora (admin manual). Landing mostra "X vagas restantes" e bloqueia botão quando esgota.
- `externalReference` no Asaas: `camp_<enrollment_id>` para o webhook reconciliar.
- Timezones: datas com `T00:00:00` no frontend e UTC-3 nas edge functions (regra do projeto).
- Tema usa apenas tokens semânticos do `index.css` (não cores fixas), mas o admin pode definir uma cor primária da edição que sobrescreve via CSS variable inline na landing.

## 7. Entregáveis

- 1 migração com 4 tabelas + RLS + bucket
- 2 edge functions novas (`vacation-camp-checkout`, ajuste em `asaas-webhook`)
- 1 página pública (`/colonia/:slug`) com seções modulares
- 1 área admin com lista e editor multi-abas
- Itens de sidebar/menu e rota no `App.tsx`

Posso implementar tudo de uma vez ou prefere dividir em duas entregas — primeiro **estrutura + landing + checkout**, depois **admin completo de gestão dos inscritos**?
