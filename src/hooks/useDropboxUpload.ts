import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DropboxFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modified?: string;
  url: string | null;
}

interface UploadResult {
  success: boolean;
  file?: DropboxFile;
  error?: string;
}

interface ListResult {
  success: boolean;
  files?: DropboxFile[];
  error?: string;
}

export function useDropboxUpload() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  const checkConfiguration = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'DROPBOX_ACCESS_TOKEN')
        .maybeSingle();

      if (error) {
        console.error('Error checking Dropbox config:', error);
        setIsConfigured(false);
        return false;
      }

      const configured = !!data?.value;
      setIsConfigured(configured);
      return configured;
    } catch (error) {
      console.error('Error checking Dropbox config:', error);
      setIsConfigured(false);
      return false;
    }
  };

  const uploadFile = async (
    file: File,
    folder: string = '/relatorios'
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Convert file to base64
      const base64Data = await fileToBase64(file);
      setUploadProgress(30);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('dropbox-upload', {
        body: {
          fileName: file.name,
          base64Data,
          contentType: file.type,
          folder,
        },
      });

      setUploadProgress(100);

      if (error) {
        const errorMessage = error.message || 'Erro ao fazer upload';
        toast({
          title: 'Erro no upload',
          description: errorMessage,
          variant: 'destructive',
        });
        return { success: false, error: errorMessage };
      }

      if (data?.error) {
        toast({
          title: 'Erro no upload',
          description: data.error,
          variant: 'destructive',
        });
        return { success: false, error: data.error };
      }

      toast({
        title: 'Upload concluído',
        description: `${file.name} foi enviado com sucesso`,
      });

      return { success: true, file: data.file };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const listFiles = async (folder: string = '/relatorios'): Promise<ListResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('dropbox-upload', {
        body: { folder },
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Add query param for list action
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-upload?action=list`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ folder }),
        }
      );

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, files: result.files || [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  };

  const deleteFile = async (path: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-upload?action=delete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path }),
        }
      );

      const result = await response.json();

      if (result.error) {
        toast({
          title: 'Erro ao deletar',
          description: result.error,
          variant: 'destructive',
        });
        return { success: false, error: result.error };
      }

      toast({
        title: 'Arquivo deletado',
        description: 'O arquivo foi removido do Dropbox',
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao deletar',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage };
    }
  };

  return {
    uploadFile,
    listFiles,
    deleteFile,
    checkConfiguration,
    isUploading,
    uploadProgress,
    isConfigured,
  };
}

// Helper function to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
