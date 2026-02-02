
# Plano: Corrigir Modal de Geração de Carnê para Exibir Saldo Restante

## Problema Identificado

No contrato do aluno **Miguel Valandro e Silva**, o modal de geração de carnê está mostrando valores incorretos:

| Campo | Valor Atual (Errado) | Valor Correto |
|-------|---------------------|---------------|
| Valor Total | R$ 4.500,00 | R$ 4.250,00 |
| Parcelas disponíveis | 1 a 12 | 1 a 17 |
| Base de cálculo | Contrato cheio | Saldo restante |

**Causa raiz**: O modal usa o `total_value` do contrato para cálculos, ignorando pagamentos já efetuados (entrada de R$ 250,00).

---

## Solução

Modificar a função `handleOpenCarneModal` para:
1. Buscar todos os pagamentos já registrados para o contrato
2. Calcular o saldo restante (total do contrato - valor já pago)
3. Calcular as parcelas restantes (parcelas originais - parcelas pagas)
4. Usar esses valores no modal

---

## Alterações Técnicas

### Arquivo: `src/pages/Contracts.tsx`

#### 1. Adicionar estado para armazenar o saldo restante

```typescript
// Novo estado para tracking do saldo
const [remainingValue, setRemainingValue] = useState<number>(0);
const [remainingInstallments, setRemainingInstallments] = useState<number>(12);
```

#### 2. Modificar `handleOpenCarneModal` para calcular saldo

```typescript
const handleOpenCarneModal = async (enrollment: typeof enrollments[0]) => {
  const contract = getContractForEnrollment(enrollment.id);
  // ... validações existentes ...
  
  // Buscar pagamentos já realizados
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('value, due_date, description')
    .eq('contract_id', contract.id);
  
  // Calcular total já pago
  const totalPaid = existingPayments?.reduce((sum, p) => sum + Number(p.value), 0) || 0;
  
  // Calcular saldo restante
  const totalValue = Number(contract.total_value);
  const remaining = totalValue - totalPaid;
  
  // Calcular parcelas restantes
  const originalInstallments = contract.installment_count || 12;
  const paidInstallments = existingPayments?.length || 0;
  const remainingCount = originalInstallments - paidInstallments;
  
  setRemainingValue(remaining);
  setRemainingInstallments(Math.max(1, remainingCount));
  
  // Pre-preencher com parcelas restantes
  setCarneInstallments(remainingCount.toString());
  // ... resto da lógica ...
};
```

#### 3. Atualizar o modal para usar saldo restante

```typescript
{/* Contract Info - Atualizado */}
<div className="bg-secondary/30 rounded-lg p-4">
  <p className="text-sm text-muted-foreground">Aluno</p>
  <p className="font-medium">{studentName}</p>
  
  <p className="text-sm text-muted-foreground mt-2">Valor Total do Contrato</p>
  <p className="text-lg font-medium">
    R$ {Number(contract.total_value).toFixed(2).replace('.', ',')}
  </p>
  
  {/* Novo: Mostrar saldo restante */}
  <p className="text-sm text-muted-foreground mt-2">Saldo a Gerar</p>
  <p className="text-xl font-bold text-primary">
    R$ {remainingValue.toFixed(2).replace('.', ',')}
  </p>
</div>
```

#### 4. Atualizar opções de parcelas para usar quantidade restante

```typescript
{/* Número de Parcelas - Dinâmico */}
<Select value={carneInstallments} onValueChange={setCarneInstallments}>
  <SelectContent>
    {Array.from({ length: remainingInstallments }, (_, i) => i + 1).map((n) => (
      <SelectItem key={n} value={n.toString()}>
        {n}x de R$ {(remainingValue / n).toFixed(2).replace('.', ',')}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

#### 5. Atualizar `handleGenerateCarne` para usar saldo

```typescript
const handleGenerateCarne = async () => {
  // ...
  // Usar remainingValue ao invés de total_value
  const installmentCount = parseInt(carneInstallments);
  const totalValue = remainingValue; // ← Mudança aqui
  
  // ... resto da lógica permanece igual ...
};
```

---

## Fluxo Visual Atualizado

```text
┌─────────────────────────────────────────────────────┐
│ Gerar Carnê de Pagamento                            │
├─────────────────────────────────────────────────────┤
│ Aluno: Miguel Valandro e Silva                      │
│                                                     │
│ Valor Total do Contrato: R$ 4.500,00                │
│ Já Pago: R$ 250,00 (1 entrada)                      │
│ ─────────────────────────────────                   │
│ Saldo a Gerar: R$ 4.250,00                          │
│                                                     │
│ ┌─────────────────┐  ┌─────────────────┐            │
│ │ Parcelas: 17▼   │  │ Dia Venc.: 27▼  │            │
│ └─────────────────┘  └─────────────────┘            │
│                                                     │
│ ┌─────────────────────────────────────┐             │
│ │ Parcelas: 17x                       │             │
│ │ Valor da Parcela: R$ 250,00         │             │
│ │ Primeiro Vencimento: 27/02/2026     │             │
│ └─────────────────────────────────────┘             │
│                                                     │
│                    [Cancelar] [Gerar Carnê]         │
└─────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Contracts.tsx` | Adicionar estados, calcular saldo, atualizar modal |

---

## Benefícios

1. **Precisão**: O valor gerado será exatamente o saldo pendente
2. **Consistência**: Contratos com entrada já paga terão o carnê gerado corretamente
3. **Flexibilidade**: O número de parcelas será dinâmico baseado no contrato original
4. **Transparência**: O usuário verá claramente o que já foi pago vs. o que será gerado
