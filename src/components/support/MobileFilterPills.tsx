import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface MobileFilterPillsProps {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

export function MobileFilterPills({ filters, activeFilter, onFilterChange }: MobileFilterPillsProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 px-4 py-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              "active:scale-95 touch-manipulation select-none",
              activeFilter === filter.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold",
                activeFilter === filter.id
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-destructive text-destructive-foreground"
              )}>
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="invisible" />
    </ScrollArea>
  );
}
