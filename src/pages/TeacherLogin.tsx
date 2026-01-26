import { useState } from 'react';
import { Loader2, GraduationCap, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function TeacherLogin() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loggedInTeacher, setLoggedInTeacher] = useState<{
    id: string;
    name: string;
    email: string;
    matricula: string;
  } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('teacher-api', {
        body: { email: email.trim(), password: password.trim() },
        headers: {
          'x-api-key': 'teacher_api_circuitokids_2025',
        },
        method: 'POST',
      });

      // Parse the response - the function returns auth result
      if (error) {
        throw new Error(error.message || 'Erro ao autenticar');
      }

      // Check for path-based routing in response
      const response = data;
      
      if (response?.success && response?.teacher) {
        setLoggedInTeacher(response.teacher);
        toast({
          title: 'Login realizado!',
          description: `Bem-vindo(a), ${response.teacher.name}!`,
        });
      } else {
        throw new Error(response?.error || 'Credenciais inválidas');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Erro no login',
        description: error.message || 'Email ou senha incorretos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setLoggedInTeacher(null);
    setEmail('');
    setPassword('');
  };

  if (loggedInTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Portal do Professor</CardTitle>
            <CardDescription>Você está conectado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">Professor</p>
              <p className="font-medium">{loggedInTeacher.name}</p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">Matrícula</p>
              <p className="font-mono">{loggedInTeacher.matricula}</p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm">{loggedInTeacher.email}</p>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Área em desenvolvimento. Em breve você terá acesso aos dados dos alunos de reforço.
              </p>
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Portal do Professor</CardTitle>
          <CardDescription>
            Acesse com suas credenciais fornecidas pela escola
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="professor@circuitokids.com.br"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não tem acesso? Solicite suas credenciais na secretaria.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
