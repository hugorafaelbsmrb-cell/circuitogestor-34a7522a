import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser, RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onEnd?: () => void;
  className?: string;
}

export interface SignaturePadRef {
  isEmpty: () => boolean;
  clear: () => void;
  toDataURL: () => string;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onEnd, className = '' }, ref) => {
    const signatureRef = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => signatureRef.current?.isEmpty() ?? true,
      clear: () => signatureRef.current?.clear(),
      toDataURL: () => signatureRef.current?.getTrimmedCanvas().toDataURL('image/png') ?? '',
    }));

    // Adjust canvas size on mount and resize
    useEffect(() => {
      const resizeCanvas = () => {
        if (containerRef.current && signatureRef.current) {
          const canvas = signatureRef.current.getCanvas();
          const ratio = window.devicePixelRatio || 1;
          const rect = containerRef.current.getBoundingClientRect();
          
          canvas.width = rect.width * ratio;
          canvas.height = rect.height * ratio;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(ratio, ratio);
          }
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const handleClear = () => {
      signatureRef.current?.clear();
    };

    return (
      <div className={`space-y-2 ${className}`}>
        <div 
          ref={containerRef}
          className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden"
          style={{ height: '200px' }}
        >
          <SignatureCanvas
            ref={signatureRef}
            penColor="black"
            canvasProps={{
              className: 'w-full h-full cursor-crosshair',
            }}
            onEnd={onEnd}
          />
          <div className="absolute bottom-2 left-2 right-2 border-b border-muted-foreground/30 pointer-events-none">
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-white px-2">
              Assine aqui
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-2"
          >
            <Eraser className="w-4 h-4" />
            Limpar
          </Button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
