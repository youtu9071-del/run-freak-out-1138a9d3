export const PHOTO_MAX_EDGE = 768;
export const PHOTO_MAX_BYTES = 300 * 1024;

export function photoDimensions(width: number, height: number) {
  const ratio = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export function ownedAvatarPath(url: string | null | undefined, userId: string) {
  if (!url) return null;
  try {
    const path = decodeURIComponent(new URL(url).pathname.split('/storage/v1/object/public/avatars/')[1] || '');
    return path.startsWith(`${userId}/`) && !path.includes('..') ? path : null;
  } catch { return null; }
}

export async function compressProfilePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez une photo valide.');
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('Photo illisible. Essayez une photo JPEG, PNG ou WebP.');
  });
  try {
    const canvas = document.createElement('canvas');
    const dimensions = photoDimensions(image.width, image.height);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Impossible de préparer la photo.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= PHOTO_MAX_BYTES) return blob;
    }
    throw new Error('Photo trop volumineuse. Choisissez une autre image.');
  } finally { image.close(); }
}