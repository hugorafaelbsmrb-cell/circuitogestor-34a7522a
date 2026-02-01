
# Plano: Sistema de Registro de Presença de Alunos

## Visão Geral

Criar um sistema completo de controle de presença que permite à secretaria registrar a chegada dos alunos, monitorar ausências e notificar responsáveis automaticamente via WhatsApp quando um aluno não comparece dentro do período de tolerância configurado.

---

## Funcionalidades Principais

### 1. Página Pública de Registro de Presença (`/presenca`)
Uma página simplificada (similar à `/cantina`) que exibe apenas os alunos esperados para o dia e horário atual, permitindo que a secretaria marque a presença com um clique.

### 2. Painel Administrativo de Presença
Visão completa para usuários logados com:
- Lista de alunos que ainda não chegaram
- Histórico de presenças/ausências
- Estatísticas e relatórios

### 3. Configuração de Tolerância
Permitir ao administrador definir:
- Tempo de tolerância após o horário de início da aula (ex: 15 minutos)
- Habilitar/desabilitar notificação automática de ausência
- Template da mensagem de ausência

### 4. Notificação Automática de Ausência
Edge function que envia WhatsApp ao responsável informando que o aluno não compareceu, disparada após o período de tolerância.

---

## Detalhes Técnicos

### Banco de Dados

**Nova tabela: `attendance_records`**
```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  enrollment_id UUID REFERENCES enrollments(id),
  class_group_id UUID REFERENCES class_groups(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_time TIME NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'present', 'absent', 'late'
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, attendance_date, class_group_id)
);
```

**Nova configuração em `automation_settings`:**
- `auto_absence_notification` - Habilita/desabilita notificação automática
- Config JSON: `{ tolerance_minutes: 15, send_immediately: false }`

**Novo template em `app_settings`:**
- `absence_notification_template` - Mensagem personalizada de ausência

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/AttendancePublic.tsx` | Página pública para registro rápido |
| `src/pages/AttendanceAdmin.tsx` | Painel administrativo completo |
| `src/hooks/useAttendance.ts` | Hook para lógica de presença |
| `src/components/attendance/StudentCheckIn.tsx` | Componente de check-in |
| `src/components/attendance/PendingStudentsList.tsx` | Lista de alunos pendentes |
| `src/components/attendance/AttendanceStats.tsx` | Estatísticas do dia |
| `src/components/attendance/AttendanceHistory.tsx` | Histórico de presenças |
| `supabase/functions/send-absence-notification/index.ts` | Edge function para WhatsApp |
| `supabase/functions/check-pending-attendance/index.ts` | Cron job para verificar ausências |

### Fluxo de Funcionamento

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE PRESENÇA                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Início do dia                                               │
│     ↓                                                           │
│  Sistema gera registros "pending" para todos os alunos          │
│  esperados no dia (baseado em enrollment_schedules)             │
│     ↓                                                           │
│  2. Secretaria acessa /presenca                                 │
│     ↓                                                           │
│  Página mostra apenas alunos do turno atual                     │
│     ↓                                                           │
│  3. Aluno chega → Secretaria clica no nome                      │
│     ↓                                                           │
│  Status atualizado para "present" ou "late"                     │
│     ↓                                                           │
│  4. Após tolerância (ex: 15 min)                                │
│     ↓                                                           │
│  Cron job verifica pendentes e marca como "absent"              │
│     ↓                                                           │
│  5. Se automação ativada → Envia WhatsApp ao responsável        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Interface da Página Pública (`/presenca`)

- **Filtro automático**: Mostra apenas alunos do dia/horário atual
- **Busca rápida**: Campo de pesquisa por nome
- **Cards de aluno**: Nome, curso, horário esperado
- **Ação de check-in**: Botão ou toque para marcar presença
- **Indicadores visuais**: Verde (presente), Amarelo (atrasado), Vermelho (ausente), Cinza (pendente)

### Interface do Painel Admin (`/presenca-admin`)

- **Dashboard do dia**: Total esperado, presentes, ausentes, pendentes
- **Abas**: Pendentes | Histórico | Configurações
- **Filtros**: Por curso, turno, data
- **Ações em lote**: Marcar todos como ausentes, reenviar notificações
- **Configuração de tolerância**: Campo para definir minutos
- **Toggle de automação**: Ativar/desativar notificação automática
- **Editor de template**: Personalizar mensagem de ausência

### Variáveis do Template de Ausência

| Variável | Descrição |
|----------|-----------|
| `{nome_responsavel}` | Primeiro nome do responsável |
| `{nome_aluno}` | Nome completo do aluno |
| `{curso}` | Nome do curso |
| `{horario}` | Horário esperado |
| `{data}` | Data formatada |
| `{nome_escola}` | Nome da escola |

**Exemplo de mensagem padrão:**
```
Olá, {nome_responsavel}! 👋

Notamos que *{nome_aluno}* não compareceu à aula de *{curso}* hoje ({data}) às {horario}.

Está tudo bem? Se precisar reagendar ou tiver alguma dúvida, entre em contato conosco.

Atenciosamente,
*{nome_escola}*
```

### Rotas

| Rota | Tipo | Descrição |
|------|------|-----------|
| `/presenca` | Pública | Registro rápido de presença |
| `/presenca-admin` | Protegida | Painel administrativo |

### Sidebar

Adicionar no menu "Acadêmico":
- Ícone: `UserCheck` ou `ClipboardCheck`
- Label: "Presença"
- Path: `/presenca-admin`

### Políticas RLS

- **attendance_records**:
  - SELECT: Authenticated users
  - INSERT: Public (para registro via página pública) + Authenticated
  - UPDATE: Authenticated users
  - DELETE: Admins only

### Cron Job

Configurar um job que executa a cada 5 minutos para verificar alunos que passaram do período de tolerância e ainda estão como "pending":

```sql
SELECT cron.schedule(
  'check-pending-attendance',
  '*/5 * * * *',
  $$ SELECT net.http_post(...) $$
);
```

---

## Resumo de Entregáveis

1. Tabela `attendance_records` com RLS
2. Página pública `/presenca` para check-in rápido
3. Página admin `/presenca-admin` com gestão completa
4. Configuração de tolerância e automação
5. Edge function para notificação de ausência
6. Cron job para verificar pendentes automaticamente
7. Template personalizável de mensagem
8. Atualização do sidebar com novo item

