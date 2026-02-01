import { useState, useMemo } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileFilterPills } from './MobileFilterPills';
import { MobileConversationItem, ConversationData } from './MobileConversationItem';
import { cn } from '@/lib/utils';

interface MobileConversationListProps {
  conversations: ConversationData[];
  courses: { id: string; name: string }[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelectConversation: (conversation: ConversationData) => void;
}

export function MobileConversationList({
  conversations,
  courses,
  isLoading,
  isRefreshing,
  onRefresh,
  onSelectConversation,
}: MobileConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Build filter options from courses
  const filterOptions = useMemo(() => {
    const options = [
      { id: 'all', label: 'Todos' },
      { 
        id: 'unread', 
        label: 'Não Lidos',
        count: conversations.filter(c => c.unreadCount > 0).length
      },
    ];

    // Add course-based filters
    courses.forEach(course => {
      const lowerName = course.name.toLowerCase();
      let filterId = '';
      let label = '';
      
      if (lowerName.includes('reforço') || lowerName.includes('reforco')) {
        filterId = 'reforco';
        label = 'Reforço';
      } else if (lowerName.includes('robótica') || lowerName.includes('robotica')) {
        filterId = 'robotica';
        label = 'Robótica';
      } else if (lowerName.includes('soroban')) {
        filterId = 'soroban';
        label = 'Soroban';
      }
      
      if (filterId && !options.find(o => o.id === filterId)) {
        options.push({ id: filterId, label });
      }
    });

    // Add "Não Cadastrados" filter
    options.push({ 
      id: 'unknown', 
      label: 'Não Cadastrados',
      count: conversations.filter(c => !c.isRegistered).length
    });

    return options;
  }, [courses, conversations]);

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Apply category filter
    if (activeFilter === 'unread') {
      result = result.filter(c => c.unreadCount > 0);
    } else if (activeFilter === 'unknown') {
      result = result.filter(c => !c.isRegistered);
    } else if (activeFilter !== 'all') {
      result = result.filter(c => {
        return c.courseNames.some(courseName => {
          const lowerName = courseName.toLowerCase();
          if (activeFilter === 'reforco') {
            return lowerName.includes('reforço') || lowerName.includes('reforco');
          }
          if (activeFilter === 'robotica') {
            return lowerName.includes('robótica') || lowerName.includes('robotica');
          }
          if (activeFilter === 'soroban') {
            return lowerName.includes('soroban');
          }
          return false;
        });
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        c.studentNames.some(s => s.toLowerCase().includes(query))
      );
    }

    return result;
  }, [conversations, activeFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search and Refresh Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-2 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 flex-shrink-0"
          >
            <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Filter Pills */}
        <MobileFilterPills
          filters={filterOptions}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-muted-foreground">
              {searchQuery || activeFilter !== 'all'
                ? 'Nenhuma conversa encontrada com os filtros atuais.'
                : 'Nenhuma conversa disponível.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredConversations.map((conversation) => (
              <MobileConversationItem
                key={conversation.id}
                conversation={conversation}
                onSelect={onSelectConversation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
