import { createClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Supabase Storage client (server-side only)
// ──────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET ?? 'configurator-media';

function getStorageClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new MediaServiceError(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
      'CONFIG_ERROR'
    );
  }
  // Use service role key for server-side uploads (bypasses RLS)
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface UploadResult {
  url: string;
  path: string;        // storage path for deletion
  fileName: string;
  contentType: string;
  size: number;
}

export type MediaServiceErrorCode =
  | 'CONFIG_ERROR'
  | 'INVALID_FILE'
  | 'FILE_TOO_LARGE'
  | 'UPLOAD_FAILED'
  | 'DELETE_FAILED';

export class MediaServiceError extends Error {
  code: MediaServiceErrorCode;
  constructor(message: string, code: MediaServiceErrorCode) {
    super(message);
    this.name = 'MediaServiceError';
    this.code = code;
  }
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new MediaServiceError(
      `File type "${file.type}" is not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG.`,
      'INVALID_FILE'
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new MediaServiceError(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 5MB limit.`,
      'FILE_TOO_LARGE'
    );
  }
}

// ──────────────────────────────────────────────
// Path generation
// Tenant-scoped: {storeId}/{category}/{timestamp}-{sanitized-name}
// ──────────────────────────────────────────────

function generateStoragePath(
  storeId: string,
  category: 'option-values' | 'products' | 'general',
  fileName: string
): string {
  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return `${storeId}/${category}/${timestamp}-${random}-${sanitized}`;
}

// ──────────────────────────────────────────────
// Upload
// ──────────────────────────────────────────────

export async function uploadOptionValueImage(
  storeId: string,
  file: File
): Promise<UploadResult> {
  validateFile(file);

  const supabase = getStorageClient();
  const storagePath = generateStoragePath(storeId, 'option-values', file.name);

  // Convert File to ArrayBuffer for server-side upload
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('[media.service] Upload failed:', error);
    throw new MediaServiceError(
      `Upload failed: ${error.message}`,
      'UPLOAD_FAILED'
    );
  }

  // Generate public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  };
}

// ──────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────

export async function deleteImage(storagePath: string): Promise<void> {
  const supabase = getStorageClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error('[media.service] Delete failed:', error);
    throw new MediaServiceError(
      `Delete failed: ${error.message}`,
      'DELETE_FAILED'
    );
  }
}

// ──────────────────────────────────────────────
// URL helpers
// ──────────────────────────────────────────────

/**
 * Generate a public URL for a storage path.
 * If the input is already a full URL, return it as-is.
 */
export function getPublicUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const supabase = getStorageClient();
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(pathOrUrl);

  return data.publicUrl;
}
