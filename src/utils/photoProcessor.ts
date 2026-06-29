// Client-side image processing for vacation camp photo album.
// Applies optional watermark (logo at bottom-right) or themed frame (border + footer band).

export interface ProcessOptions {
  logoUrl?: string | null;
  frameColor?: string;
  eventTitle?: string;
  watermark?: boolean;
  frame?: boolean;
  maxSize?: number; // max width/height in px to downscale for upload
  quality?: number;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function processImage(file: File, opts: ProcessOptions): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; }> {
  const maxSize = opts.maxSize ?? 1920;
  const quality = opts.quality ?? 0.86;
  const src = await loadImage(URL.createObjectURL(file));

  // Downscale if needed
  let w = src.width;
  let h = src.height;
  if (Math.max(w, h) > maxSize) {
    const r = maxSize / Math.max(w, h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }

  // Add frame overhead
  const framePad = opts.frame ? Math.round(Math.min(w, h) * 0.04) : 0;
  const footerH = opts.frame ? Math.round(h * 0.09) : 0;

  const canvasW = w + framePad * 2;
  const canvasH = h + framePad * 2 + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  if (opts.frame) {
    ctx.fillStyle = opts.frameColor || "#f97316";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  ctx.drawImage(src, framePad, framePad, w, h);

  // Watermark logo at bottom-right of the photo area
  if (opts.watermark && opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const lw = Math.round(w * 0.18);
      const lh = Math.round(lw * (logo.height / logo.width));
      const lx = framePad + w - lw - Math.round(w * 0.02);
      const ly = framePad + h - lh - Math.round(h * 0.02);
      ctx.globalAlpha = 0.78;
      ctx.drawImage(logo, lx, ly, lw, lh);
      ctx.globalAlpha = 1;
    } catch (e) {
      console.warn("Logo carregamento falhou", e);
    }
  }

  // Footer band on frame
  if (opts.frame && footerH > 0) {
    const footerY = framePad + h;
    // Logo on the footer (left)
    if (opts.logoUrl) {
      try {
        const logo = await loadImage(opts.logoUrl);
        const lh = Math.round(footerH * 0.7);
        const lw = Math.round(lh * (logo.width / logo.height));
        const lx = framePad + Math.round(footerH * 0.2);
        const ly = footerY + (footerH - lh) / 2;
        ctx.drawImage(logo, lx, ly, lw, lh);
      } catch {}
    }
    if (opts.eventTitle) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(footerH * 0.42)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.eventTitle, framePad + w - Math.round(footerH * 0.3), footerY + footerH / 2);
    }
  }

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
  const dataUrl: string = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });

  return { blob, dataUrl, width: canvasW, height: canvasH };
}
