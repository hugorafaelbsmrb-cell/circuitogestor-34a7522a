import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser, RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onEnd?: () => void;
  className?: string;
  height?: number;
}

export interface SignaturePadRef {
  isEmpty: () => boolean;
  clear: () => void;
  toDataURL: () => string;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onEnd, className = '', height = 200 }, ref) => {
    const signatureRef = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => signatureRef.current?.isEmpty() ?? true,
      clear: () => signatureRef.current?.clear(),
      toDataURL: () => {
        if (!signatureRef.current) return '';
        try {
          console.log('[SignaturePad] Generating signature data URL...');
          return signatureRef.current.toDataURL('image/png');
        } catch (error) {
          console.error('[SignaturePad] Error getting signature data:', error);
          return '';
        }
      },
    }));

    // Adjust canvas size on mount and resize
    useEffect(() => {
      const resizeCanvas = () => {
        if (containerRef.current && signatureRef.current) {
          console.log('[SignaturePad] Resizing canvas for Safari compatibility...');
          
          const canvas = signatureRef.current.getCanvas();
          const ratio = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
          const rect = containerRef.current.getBoundingClientRect();
          
          // Set explicit dimensions for Safari
          const width = Math.floor(rect.width);
          const height = Math.floor(rect.height);
          
          canvas.width = width * ratio;
          canvas.height = height * ratio;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
          
          // Set explicit attributes for Safari
          canvas.setAttribute('width', String(width * ratio));
          canvas.setAttribute('height', String(height * ratio));
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(ratio, ratio);
          }
          
          console.log('[SignaturePad] Canvas resized:', { width, height, ratio });
        }
      };

      // Initial resize with delay for Safari
      setTimeout(resizeCanvas, 100);
      resizeCanvas();
      
      window.addEventListener('resize', resizeCanvas);
      
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }, []);

    const handleClear = () => {
      console.log('[SignaturePad] Clearing signature...');
      signatureRef.current?.clear();
    };

    return (
      <div className={`space-y-2 ${className}`}>
        <div 
          ref={containerRef}
          className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden touch-none"
          style={{ 
            height: `${height}px`,
            minHeight: `${height}px`,
            width: '100%',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
        >
          <SignatureCanvas
            ref={signatureRef}
            penColor="black"
            velocityFilterWeight={0.7}
            minWidth={0.5}
            maxWidth={2.5}
            dotSize={1}
            throttle={16}
            canvasProps={{
              className: 'w-full h-full cursor-crosshair touch-none',
              style: {
                touchAction: 'none',
                WebkitUserSelect: 'none'
              }
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
