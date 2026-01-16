import { useState } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin,
  Loader2,
  User,
  Pencil,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSchool } from '@/contexts/SchoolContext';
import WhatsAppTemplateSelector from '@/components/whatsapp/WhatsAppTemplateSelector';
import EditGuardianModal from '@/components/guardians/EditGuardianModal';
import { DbGuardian } from '@/hooks/useSchoolData';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Guardians() {
  const { guardians, students, isLoading, updateGuardian, deleteStudent } = useSchool();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGuardian, setEditingGuardian] = useState<DbGuardian | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleEdit = (guardian: DbGuardian) => {
    setEditingGuardian(guardian);
    setShowEditModal(true);
  };

  const handleSaveGuardian = async (id: string, data: Partial<DbGuardian>) => {
    await updateGuardian(id, data);
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
      toast({
        title: 'Aluno excluído',
        description: `${studentToDelete.name} foi excluído com sucesso. Você pode refazer a matrícula.`,
      });
      setStudentToDelete(null);
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o aluno. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
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
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground truncate">{guardian.name}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleEdit(guardian as DbGuardian)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
                          <div className="flex flex-wrap gap-2">
                            {guardianStudents.map(student => (
                              <div 
                                key={student.id} 
                                className="flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-full group"
                              >
                                <span>{student.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0 hover:bg-destructive/20 hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStudentToDelete({ id: student.id, name: student.name });
                                  }}
                                  title="Excluir aluno"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
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

      <EditGuardianModal
        guardian={editingGuardian}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSave={handleSaveGuardian}
      />

      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aluno <strong>{studentToDelete?.name}</strong>?
              <br /><br />
              Esta ação irá remover e cancelar:
              <ul className="list-disc list-inside mt-2 text-muted-foreground">
                <li>Dados do aluno</li>
                <li>Matrículas vinculadas</li>
                <li>Contratos associados</li>
                <li>Carnês e boletos (cancelados na API de pagamentos)</li>
                <li>Pagamentos registrados</li>
              </ul>
              <br />
              <span className="text-destructive font-medium">Esta ação não pode ser desfeita. Você poderá refazer a matrícula e gerar novos boletos.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteStudent}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir aluno'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
