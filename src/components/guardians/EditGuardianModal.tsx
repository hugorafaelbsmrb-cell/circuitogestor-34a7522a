import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DbGuardian } from '@/hooks/useSchoolData';
import { isValidCPF, isValidEmail, formatCPF, formatPhone, formatCEP, normalizePhoneToWAPI, formatPhoneFromNormalized } from '@/utils/validators';

interface EditGuardianModalProps {
  guardian: DbGuardian | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<DbGuardian>) => Promise<void>;
}

export default function EditGuardianModal({
  guardian,
  open,
  onOpenChange,
  onSave,
}: EditGuardianModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    email: '',
    phone: '',
    address: '',
    address_number: '',
    province: '',
    postal_code: '',
  });

  useEffect(() => {
    if (guardian) {
      setFormData({
        name: guardian.name || '',
        cpf: guardian.cpf || '',
        email: guardian.email || '',
        phone: formatPhoneFromNormalized(guardian.phone || ''),
        address: guardian.address || '',
        address_number: guardian.address_number || '',
        province: guardian.province || '',
        postal_code: guardian.postal_code || '',
      });
    }
  }, [guardian]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardian) return;

    // Validate CPF
    if (!isValidCPF(formData.cpf)) {
      toast({
        title: 'CPF inválido',
        description: 'Por favor, insira um CPF válido.',
        variant: 'destructive',
      });
      return;
    }

    // Validate Email
    if (!isValidEmail(formData.email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Por favor, insira um e-mail válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Normalize phone before saving
      const dataToSave = {
        ...formData,
        phone: normalizePhoneToWAPI(formData.phone),
      };
      await onSave(guardian.id, dataToSave);
      toast({
        title: 'Sucesso',
        description: 'Dados do responsável atualizados com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar os dados.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Responsável</DialogTitle>
          <DialogDescription>
            Atualize os dados do responsável abaixo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cpf: formatCPF(e.target.value),
                  }))
                }
                className={formData.cpf && !isValidCPF(formData.cpf) ? 'border-destructive' : ''}
                required
              />
              {formData.cpf && !isValidCPF(formData.cpf) && (
                <p className="text-xs text-destructive mt-1">CPF inválido</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phone: formatPhone(e.target.value),
                  }))
                }
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className={formData.email && !isValidEmail(formData.email) ? 'border-destructive' : ''}
                required
              />
              {formData.email && !isValidEmail(formData.email) && (
                <p className="text-xs text-destructive mt-1">E-mail inválido</p>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="address_number">Número</Label>
              <Input
                id="address_number"
                value={formData.address_number}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    address_number: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="province">Bairro</Label>
              <Input
                id="province"
                value={formData.province}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, province: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="postal_code">CEP</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    postal_code: formatCEP(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
