import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useExternalApi, Order } from '@/hooks/useExternalApi';
import { Eye, RefreshCw, Loader2, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ORDER_STATUS = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Processando', color: 'bg-purple-100 text-purple-800' },
  shipped: { label: 'Enviado', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

export function OrdersTab() {
  const { toast } = useToast();
  const api = useExternalApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newStatus, setNewStatus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    const result = await api.getOrders(statusFilter !== 'all' ? statusFilter : undefined);
    if (result.data) setOrders(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleViewOrder = async (order: Order) => {
    setIsLoading(true);
    const result = await api.getOrder(order.id);
    if (result.data) {
      setSelectedOrder(result.data);
      setNewStatus(result.data.status);
      setNotes(result.data.notes || '');
      setDialogOpen(true);
    }
    setIsLoading(false);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    
    setIsLoading(true);
    const result = await api.updateOrder(selectedOrder.id, { status: newStatus as Order['status'], notes });
    
    if (result.data) {
      toast({ title: 'Sucesso', description: 'Pedido atualizado' });
      setDialogOpen(false);
      loadData();
    }
    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription>Gerencie os pedidos da loja</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(ORDER_STATUS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mb-4" />
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const status = ORDER_STATUS[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                    <TableCell>
                      <Badge className={status.color}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(order.total)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Order Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
            <DialogDescription>
              Pedido: {selectedOrder?.id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              {/* Customer Info */}
              {selectedOrder.profile && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <h4 className="font-medium mb-2">Cliente</h4>
                  <p className="text-sm">{selectedOrder.profile.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.profile.email}</p>
                  {selectedOrder.profile.phone && (
                    <p className="text-sm text-muted-foreground">{selectedOrder.profile.phone}</p>
                  )}
                </div>
              )}

              {/* Order Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Itens</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm bg-muted/30 rounded p-2">
                        <span>{item.product?.name || 'Produto'} x{item.quantity}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_STATUS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre o pedido..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleUpdateOrder} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
