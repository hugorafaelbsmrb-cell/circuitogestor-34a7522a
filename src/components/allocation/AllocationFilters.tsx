import { Search, BookOpen, GraduationCap, Filter, Sun, Sunset } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Teacher, ShiftFilter } from './types';

interface AllocationFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  courseFilter: string;
  setCourseFilter: (value: string) => void;
  teacherFilter: string;
  setTeacherFilter: (value: string) => void;
  shiftFilter: ShiftFilter;
  setShiftFilter: (value: ShiftFilter) => void;
  uniqueCourses: string[];
  teachers: Teacher[];
}

export function AllocationFilters({
  searchTerm,
  setSearchTerm,
  courseFilter,
  setCourseFilter,
  teacherFilter,
  setTeacherFilter,
  shiftFilter,
  setShiftFilter,
  uniqueCourses,
  teachers
}: AllocationFiltersProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger>
              <BookOpen className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cursos</SelectItem>
              {uniqueCourses.map(course => (
                <SelectItem key={course} value={course}>{course}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger>
              <GraduationCap className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Professor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os professores</SelectItem>
              {teachers.map(teacher => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.courseName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={shiftFilter} onValueChange={(v) => setShiftFilter(v as ShiftFilter)}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              <SelectItem value="morning">
                <span className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  Matutino
                </span>
              </SelectItem>
              <SelectItem value="afternoon">
                <span className="flex items-center gap-2">
                  <Sunset className="w-4 h-4 text-indigo-500" />
                  Vespertino
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
