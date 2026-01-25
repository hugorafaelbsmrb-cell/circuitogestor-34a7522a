import { ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartSummaryProps {
  cart: CartItem[];
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  studentName: string | null;
}

export function CartSummary({ 
  cart, 
  onRemoveItem, 
  onClearCart, 
  onConfirm, 
  isSubmitting,
  studentName
}: CartSummaryProps) {
  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (cart.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg p-6 text-center">
        <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Nenhum item adicionado</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <span className="font-semibold">Resumo do Pedido</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClearCart}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {cart.map(item => (
          <div key={item.product.id} className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {item.quantity}x {item.product.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">
                {formatPrice(item.product.price * item.quantity)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveItem(item.product.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        <div className="border-t border-border pt-3 mt-3">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total ({itemsCount} {itemsCount === 1 ? 'item' : 'itens'})</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted/30">
        <Button 
          className="w-full h-12 text-base font-semibold"
          onClick={onConfirm}
          disabled={isSubmitting || !studentName}
        >
          {isSubmitting ? 'Registrando...' : 'Confirmar Consumo'}
        </Button>
        {!studentName && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Selecione um aluno para continuar
          </p>
        )}
      </div>
    </div>
  );
}
