import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, FileText, MessageCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  created_at: string;
}

interface Suggestion {
  text: string;
  tone: 'formal' | 'informal' | 'empático';
}

interface Summary {
  summary: string;
  mainTopics: string[];
  pendingActions: string[];
  sentiment: 'positivo' | 'neutro' | 'negativo';
}

interface AISuggestionsPanelProps {
  messages: Message[];
  guardianName: string;
  studentNames?: string[];
  courseNames?: string[];
  onSelectSuggestion: (text: string) => void;
}

export function AISuggestionsPanel({
  messages,
  guardianName,
  studentNames = [],
  courseNames = [],
  onSelectSuggestion,
}: AISuggestionsPanelProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const hasIncomingMessages = messages.some(m => m.direction === 'incoming');

  const generateSuggestions = async () => {
    if (messages.length === 0) {
      toast({
        title: 'Sem mensagens',
        description: 'Não há mensagens para analisar.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-messages', {
        body: {
          messages: messages.slice(-10), // Last 10 messages for context
          type: 'suggest',
          guardianName,
          studentNames,
          courseNames,
        },
      });

      if (error) throw error;

      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast({
        title: 'Erro ao gerar sugestões',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const generateSummary = async () => {
    if (messages.length < 3) {
      toast({
        title: 'Poucas mensagens',
        description: 'É necessário pelo menos 3 mensagens para gerar um resumo.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingSummary(true);
    setShowSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-messages', {
        body: {
          messages,
          type: 'summary',
          guardianName,
          studentNames,
          courseNames,
        },
      });

      if (error) throw error;

      if (data?.summary) {
        setSummary(data);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: 'Erro ao gerar resumo',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
      setShowSummary(false);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const getToneBadgeVariant = (tone: string) => {
    switch (tone) {
      case 'formal': return 'secondary';
      case 'informal': return 'outline';
      case 'empático': return 'default';
      default: return 'secondary';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positivo': return 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400';
      case 'negativo': return 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400';
      default: return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400';
    }
  };

  if (messages.length === 0) return null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border-t bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full flex items-center justify-between px-4 py-2 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Assistente IA</span>
            </div>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateSuggestions}
                disabled={isLoadingSuggestions || !hasIncomingMessages}
                className="flex-1"
                title={!hasIncomingMessages ? 'Aguardando mensagem do responsável' : undefined}
              >
                {isLoadingSuggestions ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                Sugerir Respostas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateSummary}
                disabled={isLoadingSummary || messages.length < 3}
                className="flex-1"
              >
                {isLoadingSummary ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Resumir Conversa
              </Button>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Sugestões de resposta:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateSuggestions}
                    disabled={isLoadingSuggestions}
                    className="h-6 px-2"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => onSelectSuggestion(suggestion.text)}
                      className="w-full text-left p-2 rounded-lg bg-background border hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm flex-1">{suggestion.text}</span>
                        <Badge variant={getToneBadgeVariant(suggestion.tone)} className="text-[10px] shrink-0">
                          {suggestion.tone}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {showSummary && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Resumo da conversa:</span>
                {isLoadingSummary ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : summary ? (
                  <div className="p-3 rounded-lg bg-background border space-y-3">
                    {/* Sentiment Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Sentimento:</span>
                      <Badge className={getSentimentColor(summary.sentiment)}>
                        {summary.sentiment}
                      </Badge>
                    </div>

                    {/* Summary Text */}
                    <p className="text-sm whitespace-pre-wrap">{summary.summary}</p>

                    {/* Main Topics */}
                    {summary.mainTopics?.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Tópicos principais:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {summary.mainTopics.map((topic, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending Actions */}
                    {summary.pendingActions?.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 mb-1">
                          <AlertCircle className="h-3 w-3" />
                          <span className="text-xs font-medium">Ações pendentes:</span>
                        </div>
                        <ul className="text-xs space-y-1">
                          {summary.pendingActions.map((action, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-amber-600">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Helper text when no suggestions yet */}
            {suggestions.length === 0 && !showSummary && (
              <p className="text-xs text-center text-muted-foreground py-2">
                Use os botões acima para obter ajuda da IA
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
