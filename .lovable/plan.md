
# Plano: Corrigir Query de Alocação de Alunos na Agenda Semanal

## Problema Identificado

A query atual na página `StudentAllocation.tsx` usa filtros aninhados que **não funcionam corretamente** com o SDK do Supabase:

```typescript
// PROBLEMA: Esta sintaxe não filtra corretamente
.eq('enrollments.status', 'active')
.eq('enrollments.students.is_active', true)
.eq('class_groups.is_active', true)
```

Os dados existem no banco (42 registros), mas a query retorna vazio porque o Supabase JavaScript SDK não suporta bem filtros em relacionamentos profundos desta forma.

---

## Solução

Modificar a estratégia de query para buscar todos os dados da tabela `enrollment_schedules` e filtrar no lado do cliente, ou usar uma abordagem de query mais simples e eficiente.

---

## Alterações Técnicas

### Arquivo: `src/pages/StudentAllocation.tsx`

**Modificação 1:** Simplificar a query removendo os filtros aninhados e filtrando no JavaScript

A query atual:
```typescript
const { data: enrollmentSchedulesData, error: esError } = await supabase
  .from('enrollment_schedules')
  .select(`...`)
  .eq('enrollments.status', 'active')           // NÃO FUNCIONA
  .eq('enrollments.students.is_active', true)   // NÃO FUNCIONA
  .eq('class_groups.is_active', true);          // NÃO FUNCIONA
```

Nova query (sem filtros aninhados, filtragem no cliente):
```typescript
const { data: enrollmentSchedulesData, error: esError } = await supabase
  .from('enrollment_schedules')
  .select(`
    id,
    enrollment:enrollments(
      id,
      status,
      student:students(
        id,
        name,
        birth_date,
        is_active,
        guardian:guardians(name, phone)
      )
    ),
    class_group:class_groups(
      id,
      name,
      is_active,
      course:courses(id, name),
      schedule:schedules(day_of_week, start_time, end_time)
    )
  `);

// Filtrar no lado do cliente
const filteredData = enrollmentSchedulesData?.filter((es: any) => {
  const enrollment = es.enrollment;
  const student = enrollment?.student;
  const classGroup = es.class_group;
  
  return enrollment?.status === 'active' && 
         student?.is_active === true && 
         classGroup?.is_active === true;
});
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/StudentAllocation.tsx` | Remover filtros `.eq()` aninhados e filtrar dados no JavaScript após a consulta |

---

## Benefícios

1. **Correção imediata**: Os 42 alunos matriculados aparecerão corretamente na agenda semanal
2. **Compatibilidade**: Funciona com qualquer versão do Supabase SDK
3. **Simplicidade**: Código mais fácil de entender e manter
4. **Performance aceitável**: Para volumes moderados de dados (centenas de registros), a filtragem no cliente é eficiente

---

## Resultado Esperado

Após a implementação, a página de "Agenda Semanal de Alunos" mostrará:
- **Curso de Robótica**: Alunos distribuídos em Segunda, Terça, Quarta, etc.
- **Reforço Escolar**: Alunos distribuídos nos dias corretos
- **Soroban**: Alunos nos horários definidos

Cada aluno aparecerá em **todos os dias** que foram selecionados durante sua matrícula.
