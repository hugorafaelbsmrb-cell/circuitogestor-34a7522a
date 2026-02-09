import { useEffect } from 'react';

interface MetaPixelProps {
  pixelId: string;
}

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  useEffect(() => {
    if (!pixelId) return;

    // Check if pixel is already loaded
    if (window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
      return;
    }

    // Initialize Meta Pixel
    const initPixel = () => {
      const n = (window.fbq = function (...args: any[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      } as any);
      if (!window._fbq) window._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];

      // Load the Facebook SDK
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);

      // Initialize and track
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
    };

    initPixel();

    // Cleanup
    return () => {
      // Note: We don't remove the script as it may be needed by other components
    };
  }, [pixelId]);

  // NoScript fallback
  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}

// Helper to track custom events
export function trackMetaEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
}

// Common events for landing pages
export const MetaEvents = {
  Lead: 'Lead',
  CompleteRegistration: 'CompleteRegistration',
  InitiateCheckout: 'InitiateCheckout',
  ViewContent: 'ViewContent',
  Contact: 'Contact',
} as const;
