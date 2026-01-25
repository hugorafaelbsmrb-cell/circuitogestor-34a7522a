import { MessageCircle, X } from 'lucide-react';

interface WhatsAppToastProps {
  senderName: string;
  message: string;
  avatarUrl?: string | null;
  onClose?: () => void;
}

export function WhatsAppToast({ senderName, message, avatarUrl, onClose }: WhatsAppToastProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-[#075E54] rounded-xl shadow-2xl border border-[#128C7E] min-w-[320px] max-w-[400px] animate-in slide-in-from-top-2">
      {/* Avatar or WhatsApp Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#25D366] shadow-md overflow-hidden flex items-center justify-center">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={senderName}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to icon if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <MessageCircle className={`w-5 h-5 text-white ${avatarUrl ? 'hidden' : ''}`} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Sender Name */}
        <p className="font-semibold text-white text-sm mb-2">{senderName}</p>
        
        {/* Message Bubble */}
        <div className="relative">
          <div className="bg-[#DCF8C6] text-gray-800 rounded-lg rounded-tl-none px-3 py-2 text-sm shadow-sm">
            {/* Triangle pointer */}
            <div 
              className="absolute -left-2 top-0 w-0 h-0"
              style={{
                borderTop: '8px solid #DCF8C6',
                borderLeft: '8px solid transparent'
              }}
            />
            <p className="break-words">{message}</p>
          </div>
          <span className="text-[10px] text-white/60 mt-1 block">agora</span>
        </div>
      </div>
      
      {/* Close Button */}
      {onClose && (
        <button 
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/70 hover:text-white" />
        </button>
      )}
    </div>
  );
}