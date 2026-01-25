import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CampaignImage {
  id: string;
  url: string;
  title?: string;
}

interface PhotoGalleryProps {
  images: CampaignImage[];
}

export function PhotoGallery({ images }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const handlePrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === 0 ? images.length - 1 : selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === images.length - 1 ? 0 : selectedIndex + 1);
    }
  };

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-foreground">
          Nossos Alunos em Ação
        </h2>
        <p className="text-muted-foreground text-center mb-12 text-lg">
          Veja momentos especiais das nossas aulas
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all duration-300"
              onClick={() => setSelectedIndex(index)}
            >
              <img
                src={image.url}
                alt={image.title || `Foto ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
              {image.title && (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-sm font-medium">{image.title}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setSelectedIndex(null)}
            >
              <X className="w-6 h-6" />
            </Button>

            {selectedIndex !== null && (
              <>
                <img
                  src={images[selectedIndex].url}
                  alt={images[selectedIndex].title || `Foto ${selectedIndex + 1}`}
                  className="w-full max-h-[80vh] object-contain"
                />

                {images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    >
                      <ChevronLeft className="w-8 h-8" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    >
                      <ChevronRight className="w-8 h-8" />
                    </Button>
                  </>
                )}

                {images[selectedIndex].title && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-center font-medium">
                      {images[selectedIndex].title}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
