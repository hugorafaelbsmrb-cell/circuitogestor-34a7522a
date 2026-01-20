import { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Pencil, 
  BookOpen, 
  Eye, 
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  GraduationCap,
  CheckCircle,
  XCircle,
  UserX,
  UserCheck,
  Filter,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function Students() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const { 
    students, 
    guardians,
    enrollments,
    courses,
    classGroups,
    schedules,
    getGuardianById,
    getCourseById,
    getClassGroupById,
    getScheduleById,
    updateStudent,
    createEnrollment,
    deleteEnrollment,
  } = useSchool();
  
  const isAdmin = profile?.role === 'admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewEnrollmentModal, setShowNewEnrollmentModal] = useState(false);
  const [showInactivateModal, setShowInactivateModal] = useState(false);
  const [showDeleteEnrollmentModal, setShowDeleteEnrollmentModal] = useState(false);
  const [enrollmentToDelete, setEnrollmentToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    birth_date: '',
  });
  
  const [newEnrollmentForm, setNewEnrollmentForm] = useState({
    classGroupId: '',
  });

  // Filter students by search term and active status
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
    const isActive = (student as any).is_active !== false; // Default to true if not set
    return matchesSearch && (showInactive || isActive);
  });

  // Get student enrollments
  const getStudentEnrollments = (studentId: string) => {
    return enrollments.filter(e => e.student_id === studentId);
  };

  // Get available class groups for new enrollment (excluding already enrolled)
  const getAvailableClassGroups = (studentId: string) => {
    const studentEnrollments = getStudentEnrollments(studentId);
    const enrolledClassGroupIds = studentEnrollments.map(e => e.class_group_id);
    return classGroups.filter(cg => 
      !enrolledClassGroupIds.includes(cg.id) && 
      cg.is_active && 
      (cg.max_students === null || (cg.current_students || 0) < cg.max_students)
    );
  };

  const handleViewDetails = (student: typeof students[0]) => {
    setSelectedStudent(student);
    setShowDetailsModal(true);
  };

  const handleEditClick = (student: typeof students[0]) => {
    setSelectedStudent(student);
    setEditForm({
      name: student.name,
      birth_date: student.birth_date,
    });
    setShowEditModal(true);
  };

  const handleNewEnrollmentClick = (student: typeof students[0]) => {
    // Redirect to enrollment page with studentId for second course flow
    navigate(`/matricula?studentId=${student.id}`);
  };

  const handleInactivateClick = (student: typeof students[0]) => {
    setSelectedStudent(student);
    setShowInactivateModal(true);
  };

  const handleToggleActive = async () => {
    if (!selectedStudent) return;
    
    const currentStatus = (selectedStudent as any).is_active !== false;
    const newStatus = !currentStatus;
    
    setIsSubmitting(true);
    try {
      await updateStudent(selectedStudent.id, {
        is_active: newStatus,
      } as any);
      
      toast({
        title: newStatus ? 'Aluno ativado' : 'Aluno inativado',
        description: newStatus 
          ? 'O aluno foi reativado e aparecerá nos relatórios.' 
          : 'O aluno foi inativado e não aparecerá mais nos relatórios e financeiro.',
      });
      
      setShowInactivateModal(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do aluno.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedStudent) return;
    
    setIsSubmitting(true);
    try {
      await updateStudent(selectedStudent.id, {
        name: editForm.name,
        birth_date: editForm.birth_date,
      });
      
      toast({
        title: 'Aluno atualizado',
        description: 'Os dados do aluno foram atualizados com sucesso.',
      });
      
      setShowEditModal(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o aluno.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEnrollment = async () => {
    if (!selectedStudent || !newEnrollmentForm.classGroupId) return;
    
    const guardian = getGuardianById(selectedStudent.guardian_id);
    if (!guardian) {
      toast({
        title: 'Erro',
        description: 'Responsável não encontrado.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createEnrollment({
        student_id: selectedStudent.id,
        class_group_id: newEnrollmentForm.classGroupId,
        guardian_id: guardian.id,
        status: 'active',
      });
      
      toast({
        title: 'Matrícula realizada',
        description: 'O aluno foi matriculado no novo curso com sucesso.',
      });
      
      setShowNewEnrollmentModal(false);
      
      // Ask if user wants to generate contract
      toast({
        title: 'Gerar contrato?',
        description: 'Acesse a página de matrículas para gerar o contrato e carnê.',
        action: (
          <Button size="sm" onClick={() => navigate('/matricula')}>
            Ir para Matrículas
          </Button>
        ),
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível realizar a matrícula.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEnrollmentStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDeleteEnrollmentClick = (enrollmentId: string) => {
    setEnrollmentToDelete(enrollmentId);
    setShowDeleteEnrollmentModal(true);
  };

  const handleConfirmDeleteEnrollment = async () => {
    if (!enrollmentToDelete) return;
    
    setIsSubmitting(true);
    try {
      await deleteEnrollment(enrollmentToDelete);
      
      toast({
        title: 'Matrícula excluída',
        description: 'O curso, contrato e boletos foram excluídos com sucesso.',
      });
      
      setShowDeleteEnrollmentModal(false);
      setEnrollmentToDelete(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível excluir a matrícula.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-muted-foreground">Mostrar inativos</span>
            </label>
          </div>
        </div>

        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredStudents.map((student) => {
              const guardian = getGuardianById(student.guardian_id);
              const studentEnrollments = getStudentEnrollments(student.id);
              const activeEnrollments = studentEnrollments.filter(e => e.status === 'active');
              const isActive = (student as any).is_active !== false;
              
              return (
                <div key={student.id} className={`p-4 hover:bg-secondary/30 transition-colors ${!isActive ? 'opacity-60 bg-muted/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Users className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{student.name}</p>
                          {!isActive && (
                            <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Nascimento: {new Date(student.birth_date).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            {activeEnrollments.length} curso(s)
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-sm font-medium text-foreground">Responsável</p>
                        <p className="text-sm text-muted-foreground">{guardian?.name || '-'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewDetails(student)}
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditClick(student)}
                          title="Editar aluno"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleNewEnrollmentClick(student)}
                          title="Adicionar curso"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleInactivateClick(student)}
                          title={isActive ? "Inativar aluno" : "Reativar aluno"}
                          className={isActive ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}
                        >
                          {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </Button>
                      </div>
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

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Detalhes do Aluno
            </DialogTitle>
            <DialogDescription>
              Informações completas do aluno e suas matrículas
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-6">
              {/* Student Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dados do Aluno</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedStudent.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {new Date(selectedStudent.birth_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Guardian Info */}
              {(() => {
                const guardian = getGuardianById(selectedStudent.guardian_id);
                return guardian ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Responsável</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Nome</p>
                        <p className="font-medium">{guardian.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">CPF</p>
                        <p className="font-medium">{guardian.cpf}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">E-mail</p>
                        <p className="font-medium flex items-center gap-1">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {guardian.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p className="font-medium flex items-center gap-1">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {guardian.phone}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Endereço</p>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {guardian.address}
                          {guardian.address_number && `, ${guardian.address_number}`}
                          {guardian.province && ` - ${guardian.province}`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {/* Enrollments */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Matrículas ({getStudentEnrollments(selectedStudent.id).length})
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleNewEnrollmentClick(selectedStudent);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Curso
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getStudentEnrollments(selectedStudent.id).length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">
                      Nenhuma matrícula encontrada
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Curso</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Horário</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getStudentEnrollments(selectedStudent.id).map((enrollment) => {
                          const classGroup = getClassGroupById(enrollment.class_group_id);
                          const course = classGroup ? getCourseById(classGroup.course_id) : null;
                          const schedule = classGroup ? getScheduleById(classGroup.schedule_id) : null;
                          
                          return (
                            <TableRow key={enrollment.id}>
                              <TableCell className="font-medium">
                                {course?.name || '-'}
                              </TableCell>
                              <TableCell>{classGroup?.name || '-'}</TableCell>
                              <TableCell>
                                {schedule ? (
                                  <span className="text-sm">
                                    {schedule.day_of_week} • {schedule.start_time} - {schedule.end_time}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell>{getEnrollmentStatusBadge(enrollment.status)}</TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteEnrollmentClick(enrollment.id)}
                                    title="Excluir matrícula"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Fechar
            </Button>
            {selectedStudent && (
              <Button onClick={() => {
                setShowDetailsModal(false);
                handleEditClick(selectedStudent);
              }}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Aluno</DialogTitle>
            <DialogDescription>
              Atualize as informações do aluno
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Aluno</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input
                id="birthDate"
                type="date"
                value={editForm.birth_date}
                onChange={(e) => setEditForm(prev => ({ ...prev, birth_date: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting || !editForm.name || !editForm.birth_date}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Enrollment Modal */}
      <Dialog open={showNewEnrollmentModal} onOpenChange={setShowNewEnrollmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Curso</DialogTitle>
            <DialogDescription>
              Matricular {selectedStudent?.name} em um novo curso
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Aluno</p>
                <p className="font-medium">{selectedStudent.name}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="classGroup">Selecione a Turma</Label>
                {getAvailableClassGroups(selectedStudent.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Não há turmas disponíveis para matrícula ou o aluno já está matriculado em todas.
                  </p>
                ) : (
                  <Select 
                    value={newEnrollmentForm.classGroupId}
                    onValueChange={(value) => setNewEnrollmentForm({ classGroupId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableClassGroups(selectedStudent.id).map((classGroup) => {
                        const course = getCourseById(classGroup.course_id);
                        const schedule = getScheduleById(classGroup.schedule_id);
                        return (
                          <SelectItem key={classGroup.id} value={classGroup.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{course?.name} - {classGroup.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {schedule?.day_of_week} • {schedule?.start_time} - {schedule?.end_time} • R$ {course?.price.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {newEnrollmentForm.classGroupId && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  {(() => {
                    const classGroup = getClassGroupById(newEnrollmentForm.classGroupId);
                    const course = classGroup ? getCourseById(classGroup.course_id) : null;
                    const schedule = classGroup ? getScheduleById(classGroup.schedule_id) : null;
                    
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Curso:</span>
                          <span className="font-medium">{course?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Turma:</span>
                          <span className="font-medium">{classGroup?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Horário:</span>
                          <span className="font-medium">{schedule?.day_of_week} {schedule?.start_time} - {schedule?.end_time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mensalidade:</span>
                          <span className="font-medium text-primary">R$ {course?.price.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEnrollmentModal(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateEnrollment} 
              disabled={isSubmitting || !newEnrollmentForm.classGroupId}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Matriculando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Matricular
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inactivate Modal */}
      <Dialog open={showInactivateModal} onOpenChange={setShowInactivateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(selectedStudent as any)?.is_active !== false ? (
                <>
                  <UserX className="w-5 h-5 text-destructive" />
                  Inativar Aluno
                </>
              ) : (
                <>
                  <UserCheck className="w-5 h-5 text-success" />
                  Reativar Aluno
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {(selectedStudent as any)?.is_active !== false 
                ? 'Ao inativar, o aluno não aparecerá mais nos relatórios e no financeiro.'
                : 'Ao reativar, o aluno voltará a aparecer nos relatórios e no financeiro.'
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Aluno</p>
              <p className="font-medium">{selectedStudent.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Status atual: {(selectedStudent as any).is_active !== false ? 'Ativo' : 'Inativo'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInactivateModal(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleToggleActive}
              disabled={isSubmitting}
              variant={(selectedStudent as any)?.is_active !== false ? 'destructive' : 'default'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (selectedStudent as any)?.is_active !== false ? (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Inativar
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Reativar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Enrollment Modal */}
      <Dialog open={showDeleteEnrollmentModal} onOpenChange={setShowDeleteEnrollmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Excluir Matrícula
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. O curso será removido do aluno e todos os contratos e boletos associados serão excluídos.
            </DialogDescription>
          </DialogHeader>
          
          {enrollmentToDelete && (() => {
            const enrollment = enrollments.find(e => e.id === enrollmentToDelete);
            const classGroup = enrollment ? getClassGroupById(enrollment.class_group_id) : null;
            const course = classGroup ? getCourseById(classGroup.course_id) : null;
            
            return enrollment ? (
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Curso</p>
                  <p className="font-medium">{course?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Turma</p>
                  <p className="font-medium">{classGroup?.name || '-'}</p>
                </div>
                <div className="pt-2 border-t border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Contrato e boletos serão excluídos permanentemente
                  </p>
                </div>
              </div>
            ) : null;
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteEnrollmentModal(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmDeleteEnrollment}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Matrícula
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
