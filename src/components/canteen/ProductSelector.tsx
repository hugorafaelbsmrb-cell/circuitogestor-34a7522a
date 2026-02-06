import { useState } from 'react';
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

const categoryConfig: Record<string, { label: string; emoji: string; color: string }> = {
  lanche: { label: 'Lanches', emoji: '🥪', color: 'bg-amber-500' },
  bebida: { label: 'Bebidas', emoji: '🧃', color: 'bg-blue-500' },
  doce: { label: 'Doces', emoji: '🍬', color: 'bg-pink-500' },
  outros: { label: 'Outros', emoji: '📦', color: 'bg-slate-500' }
};

const categoryOrder = ['lanche', 'bebida', 'doce', 'outros'];

export function ProductSelector({ 
  products, 
  cart, 
  onAddItem, 
  onRemoveItem 
}: ProductSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Get available categories (only those with products)
  const availableCategories = categoryOrder.filter(cat => groupedProducts[cat]?.length > 0);

  // Auto-select first category if none selected
  const activeCategory = selectedCategory && availableCategories.includes(selectedCategory) 
    ? selectedCategory 
    : availableCategories[0] || null;

  const getQuantity = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    return item?.quantity || 0;
  };

  const getCartCountByCategory = (category: string) => {
    return cart
      .filter(item => item.product.category === category)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const currentProducts = activeCategory ? groupedProducts[activeCategory] || [] : [];

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {availableCategories.map(category => {
          const config = categoryConfig[category] || categoryConfig.outros;
          const isActive = activeCategory === category;
          const cartCount = getCartCountByCategory(category);

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all",
                isActive 
                  ? "border-primary bg-primary/10 shadow-sm" 
                  : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
              )}
            >
              <span className="text-xl">{config.emoji}</span>
              <span className={cn(
                "font-medium text-sm whitespace-nowrap",
                isActive ? "text-primary" : "text-foreground"
              )}>
                {config.label}
              </span>
              {cartCount > 0 && (
                <span className={cn(
                  "min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center text-white",
                  config.color
                )}>
                  {cartCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      {activeCategory && (
        <div className="grid grid-cols-1 gap-2">
          {currentProducts.map(product => {
            const quantity = getQuantity(product.id);
            const isInCart = quantity > 0;

            return (
              <div
                key={product.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  isInCart 
                    ? "bg-primary/5 border-primary/30 shadow-sm" 
                    : "bg-card border-border hover:border-primary/30"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{product.name}</p>
                  <p className="text-sm text-primary font-semibold">
                    {formatPrice(product.price)}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-3">
                  {isInCart ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => onRemoveItem(product.id)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-bold text-lg">
                        {quantity}
                      </span>
                      <Button
                        variant="default"
                        size="icon"
                        className="h-9 w-9 rounded-full"
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
                      className="gap-1.5 rounded-full px-4"
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
      )}

      {availableCategories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum produto disponível
        </div>
      )}
    </div>
  );
}
