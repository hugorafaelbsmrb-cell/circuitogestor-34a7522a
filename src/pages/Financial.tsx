import { useState, useMemo } from 'react';
import { Wallet, LayoutGrid, TableIcon, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinancialFilters } from '@/components/financial/FinancialFilters';
import { FinancialStats } from '@/components/financial/FinancialStats';
import { PaymentCard } from '@/components/financial/PaymentCard';
import { PaymentTable } from '@/components/financial/PaymentTable';
import { useSchool } from '@/contexts/SchoolContext';
import type { AsaasPayment } from '@/types/school';
import { useNavigate } from 'react-router-dom';

// Mock data for demonstration - in production this would come from the API
const mockPayments: AsaasPayment[] = [
  {
    id: 'pay_001',
    customerId: 'cus_001',
    value: 299.90,
    netValue: 289.90,
    billingType: 'BOLETO',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Mensalidade - Inglês Básico - Aluno: João Silva',
    bankSlipUrl: 'https://example.com/boleto',
    invoiceUrl: 'https://example.com/fatura',
  },
  {
    id: 'pay_002',
    customerId: 'cus_001',
    value: 349.90,
    netValue: 339.90,
    billingType: 'BOLETO',
    status: 'RECEIVED',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Mensalidade - Inglês Intermediário - Aluno: Maria Santos',
    bankSlipUrl: 'https://example.com/boleto',
    invoiceUrl: 'https://example.com/fatura',
  },
  {
    id: 'pay_003',
    customerId: 'cus_002',
    value: 279.90,
    netValue: 269.90,
    billingType: 'BOLETO',
    status: 'OVERDUE',
    dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Mensalidade - Espanhol Básico - Aluno: Pedro Oliveira',
    bankSlipUrl: 'https://example.com/boleto',
    invoiceUrl: 'https://example.com/fatura',
  },
  {
    id: 'pay_004',
    customerId: 'cus_002',
    value: 199.90,
    netValue: 189.90,
    billingType: 'BOLETO',
    status: 'CONFIRMED',
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Mensalidade - Informática Kids - Aluno: Ana Costa',
    bankSlipUrl: 'https://example.com/boleto',
    invoiceUrl: 'https://example.com/fatura',
    installment: '1/3',
  },
  {
    id: 'pay_005',
    customerId: 'cus_002',
    value: 199.90,
    netValue: 189.90,
    billingType: 'BOLETO',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Mensalidade - Informática Kids - Aluno: Ana Costa',
    bankSlipUrl: 'https://example.com/boleto',
    invoiceUrl: 'https://example.com/fatura',
    installment: '2/3',
  },
];

export default function Financial() {
  const { guardians } = useSchool();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [guardianFilter, setGuardianFilter] = useState('all');
  const [sortField, setSortField] = useState('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // In production, this would be stored in state and updated by the payments page
  const [payments] = useState<AsaasPayment[]>(mockPayments);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || dateFilter !== 'all' || guardianFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setGuardianFilter('all');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredPayments = useMemo(() => {
    let result = [...payments];

    // Search filter
    if (searchTerm) {
      result = result.filter(p =>
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      result = result.filter(p => {
        const dueDate = new Date(p.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        switch (dateFilter) {
          case 'today':
            return dueDate.getTime() === today.getTime();
          case 'week': {
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            return dueDate >= today && dueDate <= weekFromNow;
          }
          case 'month': {
            const monthFromNow = new Date(today);
            monthFromNow.setMonth(monthFromNow.getMonth() + 1);
            return dueDate >= today && dueDate <= monthFromNow;
          }
          case 'overdue':
            return dueDate < today && p.status !== 'RECEIVED' && p.status !== 'CONFIRMED';
          default:
            return true;
        }
      });
    }

    // Guardian filter (would need customer mapping in production)
    // if (guardianFilter !== 'all') {
    //   result = result.filter(p => p.customerId === guardianFilter);
    // }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'dueDate':
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '');
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [payments, searchTerm, statusFilter, dateFilter, guardianFilter, sortField, sortDirection]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      totalValue: payments.reduce((sum, p) => sum + p.value, 0),
      pendingValue: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.value, 0),
      receivedValue: payments.filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED').reduce((sum, p) => sum + p.value, 0),
      overdueValue: payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + p.value, 0),
      totalPayments: payments.length,
    };
  }, [payments]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet className="w-7 h-7" />
            Financeiro
          </h1>
          <p className="page-subtitle">Gerencie todos os pagamentos e boletos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button onClick={() => navigate('/pagamentos')} className="gap-2">
            <Plus className="w-4 h-4" />
            Gerar Boleto
          </Button>
        </div>
      </div>

      {/* Stats */}
      <FinancialStats {...stats} />

      {/* Filters */}
      <FinancialFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        guardianFilter={guardianFilter}
        onGuardianChange={setGuardianFilter}
        guardians={guardians}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* View Toggle and Content */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {filteredPayments.length} {filteredPayments.length === 1 ? 'resultado' : 'resultados'}
        </p>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'cards' | 'table')}>
          <TabsList>
            <TabsTrigger value="cards" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <TableIcon className="w-4 h-4" />
              Tabela
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum pagamento encontrado com os filtros selecionados.
            </div>
          ) : (
            filteredPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))
          )}
        </div>
      ) : (
        <PaymentTable
          payments={filteredPayments}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}
    </div>
  );
}
