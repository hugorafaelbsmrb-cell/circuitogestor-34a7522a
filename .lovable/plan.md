## Objetivo

Permitir que o responsável de aluno **nosso** faça a reserva e pagamento do pacote da Colônia direto na landing pública, buscando o cadastro do aluno pelo CPF do responsável e cobrando o valor integral do pacote — com a mensalidade de **julho** marcada como paga para evitar duplicidade.

## Fluxo na landing (`VacationCampLanding.tsx`)

Hoje pacotes com `students_only = true` mostram apenas o botão "Falar com a secretaria". Vamos trocar por um botão **"Sou aluno da escola"** que abre um modal próprio:

1. **Etapa 1 — Identificação**
   - Input CPF do responsável (com máscara/validação).
   - Edge function `vacation-camp-student-lookup` busca no banco: `guardians` por CPF → `students` ativos vinculados → para cada aluno, valor da última parcela paga do `carnes` (fallback: `courses.price` da matrícula ativa).
   - Retorna lista de alunos com nome, idade, mensalidade base.

2. **Etapa 2 — Seleção do aluno**
   - Se 1 aluno: avança automático. Se múltiplos: cards para escolher.
   - Mostra:
     - Pacote escolhido: R$ 250 (ex.)
     - Mensalidade base do aluno: R$ 200 (maior valor entre matrículas ativas)
     - **Diferença a complementar: R$ 50**
     - Total a pagar: R$ 250 (valor integral)
     - Aviso: *"A mensalidade de julho deste aluno será considerada quitada — você não receberá cobrança duplicada."*

3. **Etapa 3 — Pagamento**
   - Reusa o mesmo seletor de método (PIX / Cartão / Misto / Reservar) já existente.
   - Submete via `vacation-camp-checkout` com payload extendido (student_id, base_tuition, package_diff).

## Backend

### Nova edge function `vacation-camp-student-lookup`
- Input: `{ cpf, camp_slug }`
- Valida CPF.
- Busca guardian por CPF normalizado → retorna `students` ativos com:
  - `id`, `name`, `birth_date`
  - `base_tuition`: maior valor entre as matrículas ativas, calculado por:
    1. última parcela com `status='RECEIVED'` em `carnes` do aluno;
    2. fallback `courses.price` da matrícula ativa.
- Sem dados sensíveis (não retorna CPF/email do guardian).
- Rate limit (uso da função `check_rate_limit`).

### Ajuste em `vacation-camp-checkout`
- Aceita campos opcionais: `student_id`, `base_tuition`, `is_existing_student=true`.
- Quando `is_existing_student`:
  - Cobra `package.price` integral (não a diferença).
  - Marca em `vacation_camp_enrollments` o `student_id` interno e flag `internal_student=true`.
  - Não cria novo `guardian` — usa o existente (busca pelo CPF).

### Ajuste em `asaas-webhook` (quando pagamento confirmado)
- Se `enrollment.internal_student = true`:
  - Localiza a parcela de **julho/2026** do aluno em `carnes` (mês de referência = mês da colônia, configurável via `vacation_camps.tuition_skip_month`).
  - Marca essa parcela como `RECEIVED` com `payment_method='COLONIA_FERIAS'`, `paid_at=now()`, `notes='Quitada via pacote Colônia de Férias #<enrollment_id>'`.
  - Se a parcela já estiver paga, apenas registra observação (sem duplicar).
  - Notificação WhatsApp inclui linha: *"Mensalidade de julho já quitada."*

## Migrações

```sql
ALTER TABLE public.vacation_camp_enrollments
  ADD COLUMN IF NOT EXISTS internal_student_id uuid REFERENCES public.students(id),
  ADD COLUMN IF NOT EXISTS internal_student boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_tuition numeric,
  ADD COLUMN IF NOT EXISTS tuition_carne_id uuid REFERENCES public.carnes(id);

ALTER TABLE public.vacation_camps
  ADD COLUMN IF NOT EXISTS tuition_skip_month smallint, -- 1-12
  ADD COLUMN IF NOT EXISTS tuition_skip_year smallint;
```

Admin já define no `VacationCampEditor` qual mês/ano será "quitado" (default julho/2026).

## Pacotes padrão (insert)

Atualizar (via `supabase--insert` na fase de build) os pacotes da `colonia-2026` `students_only=true`:
- Day Use: R$ 50
- Semana: R$ 250
- Completo: R$ 400

## UI — Editor (`VacationCampEditor.tsx`)

- Novo campo no formulário da colônia: "Mês/ano da mensalidade quitada" (select mês + ano).
- Pacotes exclusivos para alunos passam a ter preço fixo editável (deixa de redirecionar para WhatsApp na landing).

## Arquivos afetados

- `src/pages/VacationCampLanding.tsx` — modal "Sou aluno", busca por CPF, exibição de base+diferença.
- `src/pages/VacationCampEditor.tsx` — campo mês/ano de quitação.
- `supabase/functions/vacation-camp-student-lookup/index.ts` — nova.
- `supabase/functions/vacation-camp-checkout/index.ts` — suporte a aluno interno.
- `supabase/functions/asaas-webhook/index.ts` — quita parcela de julho ao confirmar.
- Migração SQL conforme acima.
- Insert ajustando preços dos pacotes da `colonia-2026`.

## Pontos importantes

- Função de lookup é pública (sem JWT) mas com rate limit por IP+CPF.
- CPF é validado server-side com checksum (`isValidCPF`).
- Nenhum dado sensível além de nome do aluno e mensalidade base é exposto.
- Idempotência: se o webhook reprocessar, não quita a parcela duas vezes (checa status atual).
- Se o aluno não tiver carnê/curso ativo, mostra erro claro: "Aluno sem matrícula ativa — fale com a secretaria."
