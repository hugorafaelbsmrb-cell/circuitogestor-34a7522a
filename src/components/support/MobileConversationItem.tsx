import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface ConversationData {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  studentNames: string[];
  courseNames: string[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isRegistered: boolean;
}

interface MobileConversationItemProps {
  conversation: ConversationData;
  onSelect: (conversation: ConversationData) => void;
}

export function MobileConversationItem({ conversation, onSelect }: MobileConversationItemProps) {
  const hasUnread = conversation.unreadCount > 0;

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: ptBR });
    }
    if (isYesterday(date)) {
      return 'Ontem';
    }
    return format(date, 'dd/MM', { locale: ptBR });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const truncateMessage = (msg: string | null, maxLength = 45) => {
    if (!msg) return 'Sem mensagens';
    if (msg.length <= maxLength) return msg;
    return msg.substring(0, maxLength) + '...';
  };

  return (
    <button
      onClick={() => onSelect(conversation)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
        "active:bg-accent/50 touch-manipulation",
        hasUnread 
          ? "bg-primary/5 border-l-2 border-l-primary" 
          : "hover:bg-accent/30"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={conversation.avatarUrl || undefined} alt={conversation.name} />
        <AvatarFallback className={cn(
          "text-sm font-medium",
          hasUnread ? "bg-primary/10 text-primary" : "bg-muted"
        )}>
          {getInitials(conversation.name)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-base truncate",
            hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
          )}>
            {conversation.name}
          </span>
          <span className={cn(
            "text-xs flex-shrink-0",
            hasUnread ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        {/* Student names */}
        {conversation.studentNames.length > 0 && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {conversation.studentNames.length === 1 
              ? `Aluno: ${conversation.studentNames[0]}`
              : `Alunos: ${conversation.studentNames.join(', ')}`
            }
          </p>
        )}

        {/* Last message preview */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={cn(
            "text-sm truncate flex-1",
            hasUnread ? "text-foreground" : "text-muted-foreground"
          )}>
            {truncateMessage(conversation.lastMessage)}
          </p>

          {/* Unread badge */}
          {hasUnread && (
            <span className="flex-shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
