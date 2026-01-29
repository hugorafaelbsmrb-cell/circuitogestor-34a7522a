import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

export function ReportCommentNotificationListener() {
  useEffect(() => {
    const channel = supabase
      .channel('report-comments-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'report_parent_comments'
        },
        async (payload) => {
          const newComment = payload.new as { 
            id: string; 
            report_id: string; 
            guardian_id: string | null;
            student_id: string | null;
            comment: string;
          };
          
          // Fetch guardian and student names
          let guardianName = 'Responsável';
          let studentName = 'Aluno';

          if (newComment.guardian_id) {
            const { data: guardian } = await supabase
              .from('guardians')
              .select('name')
              .eq('id', newComment.guardian_id)
              .single();
            if (guardian) {
              guardianName = guardian.name.split(' ')[0]; // First name only
            }
          }

          if (newComment.student_id) {
            const { data: student } = await supabase
              .from('students')
              .select('name')
              .eq('id', newComment.student_id)
              .single();
            if (student) {
              studentName = student.name.split(' ').slice(0, 2).join(' '); // First two names
            }
          }

          // Truncate comment for preview
          const commentPreview = newComment.comment.length > 50 
            ? newComment.comment.substring(0, 50) + '...' 
            : newComment.comment;

          toast(
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">💬 Novo Comentário no Relatório</p>
                <p className="text-sm text-muted-foreground">
                  {guardianName} comentou sobre {studentName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 italic">
                  "{commentPreview}"
                </p>
              </div>
            </div>,
            { duration: 8000 }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
