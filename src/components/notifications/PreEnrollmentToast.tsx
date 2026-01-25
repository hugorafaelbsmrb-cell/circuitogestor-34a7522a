import { UserPlus, X } from 'lucide-react';

interface PreEnrollmentToastProps {
  guardianName: string;
  studentName: string;
  onClose?: () => void;
}

export function PreEnrollmentToast({ guardianName, studentName, onClose }: PreEnrollmentToastProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-primary rounded-xl shadow-2xl border border-primary/80 min-w-[320px] max-w-[400px] animate-in slide-in-from-top-2">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-foreground/20 shadow-md flex items-center justify-center">
        <UserPlus className="w-5 h-5 text-primary-foreground" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <p className="font-semibold text-primary-foreground text-sm mb-2">
          Nova Pré-Matrícula! 🎉
        </p>
        
        {/* Info Card */}
        <div className="relative">
          <div className="bg-background text-foreground rounded-lg rounded-tl-none px-3 py-2 text-sm shadow-sm">
            {/* Triangle pointer */}
            <div 
              className="absolute -left-2 top-0 w-0 h-0"
              style={{
                borderTop: '8px solid hsl(var(--background))',
                borderLeft: '8px solid transparent'
              }}
            />
            <p className="break-words">
              <span className="font-medium">Responsável:</span> {guardianName}
            </p>
            <p className="break-words mt-1">
              <span className="font-medium">Aluno:</span> {studentName}
            </p>
          </div>
          <span className="text-[10px] text-primary-foreground/60 mt-1 block">agora</span>
        </div>
      </div>
      
      {/* Close Button */}
      {onClose && (
        <button 
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-full hover:bg-primary-foreground/10 transition-colors"
        >
          <X className="w-4 h-4 text-primary-foreground/70 hover:text-primary-foreground" />
        </button>
      )}
    </div>
  );
}
