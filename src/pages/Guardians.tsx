import { useState } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin,
  Loader2,
  User
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useSchool } from '@/contexts/SchoolContext';
import WhatsAppTemplateSelector from '@/components/whatsapp/WhatsAppTemplateSelector';

export default function Guardians() {
  const { guardians, students, isLoading } = useSchool();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGuardians = guardians.filter(guardian => {
    const matchesSearch = guardian.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guardian.phone.includes(searchTerm) ||
      guardian.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guardian.cpf.includes(searchTerm);
    return matchesSearch;
  });

  const getGuardianStudents = (guardianId: string) => {
    return students.filter(s => s.guardian_id === guardianId);
  };


  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Responsáveis</h1>
          <p className="page-subtitle">Lista de responsáveis cadastrados</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Responsáveis</h1>
        <p className="page-subtitle">Lista de responsáveis cadastrados ({guardians.length})</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredGuardians.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGuardians.map((guardian) => {
            const guardianStudents = getGuardianStudents(guardian.id);
            
            return (
              <Card key={guardian.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{guardian.name}</h3>
                      <p className="text-sm text-muted-foreground">CPF: {guardian.cpf}</p>
                      
                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span>{guardian.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{guardian.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{guardian.address}</span>
                        </div>
                      </div>

                      {guardianStudents.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-1">Alunos vinculados:</p>
                          <div className="flex flex-wrap gap-1">
                            {guardianStudents.map(student => (
                              <span 
                                key={student.id} 
                                className="text-xs bg-secondary px-2 py-0.5 rounded-full"
                              >
                                {student.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-border">
                        <WhatsAppTemplateSelector
                          phone={guardian.phone}
                          guardianId={guardian.id}
                          variables={{
                            nome_responsavel: guardian.name,
                            nome_aluno: guardianStudents[0]?.name || '',
                          }}
                          buttonVariant="outline"
                          buttonSize="sm"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? 'Nenhum responsável encontrado' : 'Nenhum responsável cadastrado'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Tente ajustar sua busca' : 'Os responsáveis são cadastrados durante a matrícula'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
