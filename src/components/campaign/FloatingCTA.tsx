import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowUp, Sparkles } from 'lucide-react';

interface FloatingCTAProps {
  onCtaClick: () => void;
  buttonText?: string;
}

export function FloatingCTA({ 
  onCtaClick, 
  buttonText = "Garantir minha vaga" 
}: FloatingCTAProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 400px
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none"
        >
          <div className="max-w-md mx-auto pointer-events-auto">
            <Button 
              size="lg"
              onClick={onCtaClick}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold py-6 rounded-full shadow-2xl hover:shadow-xl transition-all duration-300"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {buttonText}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
