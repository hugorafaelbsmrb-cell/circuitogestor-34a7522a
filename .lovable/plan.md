
# Plano: Distribuir Alunos na Alocação por Todos os Dias de Aula Escolhidos na Matrícula

## Problema Identificado

Atualmente, quando um aluno é matriculado e seleciona **múltiplos dias** da semana (ex: Segunda e Quarta), apenas **um dia** é salvo na tabela de matrículas. Isso ocorre porque:

1. O wizard de matrícula armazena os dias selecionados em `selectedSchedules` (estado local)
2. No momento de criar a matrícula, apenas o **primeiro** dia é usado para encontrar uma turma (`class_group`)
3. A tabela `enrollments` só possui **um** campo `class_group_id`, que referencia uma única turma/horário

Os dados estão sendo salvos apenas no contrato (JSON), mas a página de Alocação de Alunos não lê esses dados.

## Solução Proposta

Criar uma nova tabela de relacionamento `enrollment_schedules` para armazenar todos os dias/horários selecionados por matrícula.

---

## Etapa 1: Criar tabela de relacionamento no banco de dados

```text
┌─────────────────────────────────────────────────────────────┐
│                    enrollment_schedules                      │
├─────────────────────────────────────────────────────────────┤
│ id              │ uuid (PK)                                 │
│ enrollment_id   │ uuid (FK -> enrollments.id)               │
│ class_group_id  │ uuid (FK -> class_groups.id)              │
│ created_at      │ timestamp                                 │
└─────────────────────────────────────────────────────────────┘
```

**Migração SQL:**
- Criar tabela `enrollment_schedules` com chaves estrangeiras
- Adicionar políticas RLS para usuários autenticados
- Popular com dados existentes (migrar o `class_group_id` atual de cada matrícula)

---

## Etapa 2: Modificar o fluxo de matrícula

**Arquivo:** `src/pages/Enrollment.tsx`

Após criar a matrícula principal, iterar sobre todos os dias selecionados (`selectedSchedules`) e:
1. Encontrar o `class_group_id` correspondente para cada dia/horário
2. Inserir um registro na tabela `enrollment_schedules` para cada dia
3. Incrementar o contador de alunos em cada turma

---

## Etapa 3: Atualizar a página de Alocação de Alunos

**Arquivo:** `src/pages/StudentAllocation.tsx`

Modificar a query para buscar dados de `enrollment_schedules` em vez de usar apenas o `class_group_id` único da matrícula:

```sql
SELECT 
  e.id as enrollment_id,
  s.name as student_name,
  cg.name as class_group_name,
  sc.day_of_week,
  sc.start_time,
  sc.end_time
FROM enrollment_schedules es
JOIN enrollments e ON es.enrollment_id = e.id
JOIN students s ON e.student_id = s.id
JOIN class_groups cg ON es.class_group_id = cg.id
JOIN schedules sc ON cg.schedule_id = sc.id
WHERE e.status = 'active' AND s.is_active = true
```

---

## Etapa 4: Atualizar hook de dados

**Arquivo:** `src/hooks/useSchoolData.ts`

- Adicionar função `createEnrollmentSchedule` para inserir registros na nova tabela
- Modificar `deleteEnrollment` para também remover registros de `enrollment_schedules`
- Decrementar contadores de alunos em todas as turmas relacionadas

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| Banco de dados | Nova tabela `enrollment_schedules` + migração de dados existentes |
| `src/pages/Enrollment.tsx` | Salvar todos os dias selecionados na nova tabela |
| `src/pages/StudentAllocation.tsx` | Buscar dados de `enrollment_schedules` |
| `src/hooks/useSchoolData.ts` | Funções CRUD para `enrollment_schedules` |

---

## Benefícios

1. Cada matrícula terá todos os dias de aula corretamente registrados
2. A página de Alocação mostrará o aluno em todos os dias que ele frequenta
3. Os contadores de vagas por turma serão precisos
4. Compatibilidade retroativa com matrículas existentes (migração automática)
