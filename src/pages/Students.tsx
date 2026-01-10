import { Users, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSchool } from '@/contexts/SchoolContext';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function Students() {
  const { students, getGuardianById } = useSchool();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="page-subtitle">Gerencie os alunos matriculados</p>
        </div>
        <Link to="/matricula">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Matrícula
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredStudents.map((student) => {
              const guardian = getGuardianById(student.guardian_id);
              return (
                <div key={student.id} className="p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Nascimento: {new Date(student.birth_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">Responsável</p>
                      <p className="text-sm text-muted-foreground">{guardian?.name || '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente buscar por outro nome' : 'Comece cadastrando o primeiro aluno'}
            </p>
            {!searchTerm && (
              <Link to="/matricula">
                <Button>Nova Matrícula</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
