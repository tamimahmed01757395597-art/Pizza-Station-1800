import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { apiError, requireRole } from '@/lib/api';

const uploadSchema = z.object({
  image: z.instanceof(File).refine((file) => file.size > 0 && file.size <= 5 * 1024 * 1024),
});
const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  try {
    const { supabase } = await requireRole(['admin', 'manager']);
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Request must be multipart form data.' }, { status: 400 });
    }
    const parsed = uploadSchema.safeParse({ image: formData.get('image') });
    if (!parsed.success) return NextResponse.json({ error: 'An image up to 5 MB is required.' }, { status: 400 });
    const image = parsed.data.image;
    const extension = allowedTypes[image.type];
    if (!extension) {
      return NextResponse.json({ error: 'Image must be JPEG, PNG, or WebP and no larger than 5 MB.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8 && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
    const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if ((extension === 'jpg' && !isJpeg) || (extension === 'png' && !isPng) || (extension === 'webp' && !isWebp)) {
      return NextResponse.json({ error: 'Image content does not match its file type.' }, { status: 400 });
    }
    const path = `${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('product-images').upload(path, image, {
      contentType: image.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      console.error('Product image upload failed:', error.message);
      return NextResponse.json({ error: 'Unable to upload product image.' }, { status: 500 });
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return NextResponse.json({ path, url: data.publicUrl }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
