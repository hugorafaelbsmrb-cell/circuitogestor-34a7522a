/**
 * Utility functions for loading and converting images for PDF generation
 */

/**
 * Loads an image from a URL and converts it to a base64 data URL
 * This is necessary because jsPDF needs base64 data or properly loaded images
 */
export async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  
  // If already base64, return as-is
  if (url.startsWith('data:')) {
    return url;
  }
  
  try {
    // Fetch the image
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      console.warn('Failed to fetch image:', url, response.status);
      return null;
    }
    
    const blob = await response.blob();
    
    // Convert to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        console.warn('Failed to read image as base64:', url);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading image:', url, error);
    return null;
  }
}

/**
 * Pre-loads all images needed for contract PDF generation
 */
export async function preloadContractImages(content: {
  schoolLogo?: string;
  schoolSignatureUrl?: string | null;
  signatureImage?: string | null;
}): Promise<{
  schoolLogo: string | null;
  schoolSignatureUrl: string | null;
  signatureImage: string | null;
}> {
  console.log('Preloading contract images...');
  
  const [schoolLogo, schoolSignatureUrl, signatureImage] = await Promise.all([
    content.schoolLogo ? loadImageAsBase64(content.schoolLogo) : Promise.resolve(null),
    content.schoolSignatureUrl ? loadImageAsBase64(content.schoolSignatureUrl) : Promise.resolve(null),
    content.signatureImage ? loadImageAsBase64(content.signatureImage) : Promise.resolve(null),
  ]);
  
  console.log('Images preloaded:', {
    hasLogo: !!schoolLogo,
    hasSchoolSignature: !!schoolSignatureUrl,
    hasGuardianSignature: !!signatureImage,
  });
  
  return {
    schoolLogo,
    schoolSignatureUrl,
    signatureImage,
  };
}
