import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

interface ProductSelectorProps {
  products: Product[];
  cart: CartItem[];
  onAddItem: (product: Product) => void;
  onRemoveItem: (productId: string) => void;
}

const categoryLabels: Record<string, string> = {
  lanche: '🥪 Lanches',
  bebida: '🧃 Bebidas',
  doce: '🍬 Doces',
  outros: '📦 Outros'
};

const categoryOrder = ['lanche', 'bebida', 'doce', 'outros'];

export function ProductSelector({ 
  products, 
  cart, 
  onAddItem, 
  onRemoveItem 
}: ProductSelectorProps) {
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const getQuantity = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    return item?.quantity || 0;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {categoryOrder.map(category => {
        const categoryProducts = groupedProducts[category];
        if (!categoryProducts?.length) return null;

        return (
          <div key={category}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              {categoryLabels[category] || category}
            </h3>
            <div className="space-y-2">
              {categoryProducts.map(product => {
                const quantity = getQuantity(product.id);
                const isInCart = quantity > 0;

                return (
                  <div
                    key={product.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isInCart 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-card border-border hover:border-primary/30"
                    )}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-sm text-primary font-semibold">
                        {formatPrice(product.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isInCart ? (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onRemoveItem(product.id)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">
                            {quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onAddItem(product)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAddItem(product)}
                          className="gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
