import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  guardian_name?: string;
  guardian_phone?: string;
}

interface StudentSearchInputProps {
  students: Student[];
  onSelect: (student: Student) => void;
  selectedStudent: Student | null;
  onClear: () => void;
}

export function StudentSearchInput({ 
  students, 
  onSelect, 
  selectedStudent, 
  onClear 
}: StudentSearchInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length >= 2) {
      const filtered = students.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
      setFilteredStudents(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredStudents([]);
      setIsOpen(false);
    }
  }, [query, students]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (student: Student) => {
    onSelect(student);
    setQuery('');
    setIsOpen(false);
  };

  const handleSendMessage = () => {
    if (selectedStudent?.guardian_phone) {
      const phone = selectedStudent.guardian_phone.replace(/\D/g, '');
      const message = encodeURIComponent(`Olá! Segue informação sobre o consumo na cantina do(a) aluno(a) ${selectedStudent.name}.`);
      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
    }
  };

  if (selectedStudent) {
    return (
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{selectedStudent.name}</p>
            {selectedStudent.guardian_name && (
              <p className="text-sm text-muted-foreground">
                Resp: {selectedStudent.guardian_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedStudent.guardian_phone && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSendMessage}
              className="text-green-600 hover:text-green-700 hover:bg-green-100"
              title="Enviar mensagem no WhatsApp"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          )}
          <button 
            onClick={onClear}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Digite o nome do aluno..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredStudents.map((student) => (
            <button
              key={student.id}
              onClick={() => handleSelect(student)}
              className={cn(
                "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                "flex items-center gap-3 border-b border-border last:border-0"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{student.name}</p>
                {student.guardian_name && (
                  <p className="text-sm text-muted-foreground">
                    Resp: {student.guardian_name}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && filteredStudents.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          Nenhum aluno encontrado
        </div>
      )}
    </div>
  );
}
