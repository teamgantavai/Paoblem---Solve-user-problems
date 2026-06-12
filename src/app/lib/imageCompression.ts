/**
 * Compresses an image file client-side using a Canvas element.
 * @param file The original image File object.
 * @param quality Compression quality from 0.0 to 1.0 (default 0.75).
 * @param maxWidth Maximum width of the compressed image (default 1200px).
 * @param maxHeight Maximum height of the compressed image (default 1200px).
 */
export function compressImage(
  file: File,
  quality = 0.75,
  maxWidth = 1200,
  maxHeight = 1200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If it's a GIF, don't compress to keep animation if applicable
    if (file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions matching constraints
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to compressed Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Compression conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
