import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { uploadOptionValueImage, MediaServiceError } from '@/services/media.service';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// POST /api/media/upload
// Accepts multipart/form-data with a single "file" field.
// Returns { url, path, fileName, contentType, size }
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return tenantError('No file provided. Send a "file" field in multipart/form-data.', 400);
    }

    if (file.size === 0) {
      return tenantError('File is empty', 400);
    }

    // Upload via media service (handles validation + Supabase upload)
    const result = await uploadOptionValueImage(tenant.storeId, file);

    return tenantResponse(result, 201);
  } catch (error) {
    if (error instanceof MediaServiceError) {
      const status = error.code === 'INVALID_FILE' || error.code === 'FILE_TOO_LARGE' ? 400
        : error.code === 'CONFIG_ERROR' ? 500
        : 502;
      return tenantError(error.message, status);
    }

    console.error('[media/upload]', error);
    return tenantError('Upload failed', 500);
  }
}
