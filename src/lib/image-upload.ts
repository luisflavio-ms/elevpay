import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 1024 * 1024; // 1MB
const MAX_DIMENSION = 1600;

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Try decreasing quality until under MAX_BYTES
  for (const q of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", q),
    );
    if (blob && blob.size <= MAX_BYTES) return blob;
    if (q === 0.35 && blob) return blob;
  }
  throw new Error("Falha ao comprimir imagem");
}

export async function uploadProductImage(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem");
  if (file.size > 10 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 10MB original)");

  const compressed = await compressImage(file);
  if (compressed.size > MAX_BYTES) {
    throw new Error("Não foi possível reduzir a imagem para 1MB");
  }

  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, compressed, { contentType: "image/webp", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
