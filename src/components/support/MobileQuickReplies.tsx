import { useState, useEffect } from 'react';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface QuickReplyTemplate {
  id: string;
  label: string;
  message: string;
  sort_order: number;
  is_active: boolean;
}

interface MobileQuickRepliesProps {
  onSelect: (message: string) => void;
  studentName?: string;
}

export function MobileQuickReplies({ onSelect, studentName }: MobileQuickRepliesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([]);

  useEffect(() => {
    const loadQuickReplies = async () => {
      try {
        const { data, error } = await supabase
          .from('quick_reply_templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data) {
          setQuickReplies(data);
        }
      } catch (error) {
        console.error('Error loading quick replies:', error);
      }
    };
    
    loadQuickReplies();
  }, []);

  const processTemplate = (message: string) => {
    let processed = message;
    if (studentName) {
      processed = processed.replace(/\{aluno\}/gi, studentName);
      processed = processed.replace(/\{nome_aluno\}/gi, studentName);
    }
    return processed;
  };

  const handleSelect = (template: QuickReplyTemplate) => {
    const processed = processTemplate(template.message);
    onSelect(processed);
    setIsExpanded(false);
  };

  if (quickReplies.length === 0) {
    return null;
  }

  return (
    <div className="border-t bg-muted/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span>Respostas rápidas</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <ScrollArea className="w-full pb-2">
          <div className="flex gap-2 px-4 pb-2">
            {quickReplies.map((reply) => (
              <Button
                key={reply.id}
                variant="outline"
                size="sm"
                onClick={() => handleSelect(reply)}
                className="flex-shrink-0 text-xs h-8"
              >
                {reply.label}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      )}
    </div>
  );
}
