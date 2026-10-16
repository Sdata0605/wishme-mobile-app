import * as FileSystem from 'expo-file-system/legacy';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';

/** The storage service refuses a single upload above this, so say so before spending minutes sending it. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_ATTEMPTS = 2;

/**
 * Uploads a video to a public storage bucket and returns its public link.
 *
 * The file is streamed from the phone's storage instead of being loaded into memory (a video is far bigger than a
 * photo), and a failure is explained in words rather than reported as a bare "upload failed".
 */
export async function uploadVideo({
  uri,
  bucket,
  folder,
  token,
  sizeBytes,
  mimeType = 'video/mp4',
}: {
  uri: string;
  bucket: string;
  folder: string;
  token: string;
  sizeBytes?: number | null;
  mimeType?: string;
}): Promise<string> {
  if (sizeBytes && sizeBytes > MAX_VIDEO_BYTES) {
    throw new Error(`This video is ${(sizeBytes / 1024 / 1024).toFixed(0)} MB. Please choose one under 50 MB, or trim it to a shorter clip.`);
  }

  const ext = mimeType.includes('quicktime') ? 'mov' : 'mp4';
  const path = `${folder}/video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  let lastError = 'The upload did not finish.';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise<void>(r => setTimeout(r, 1500));
    try {
      const res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
      });
      if (res.status >= 200 && res.status < 300) return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

      let reason = `Upload refused (${res.status}).`;
      try { reason = (JSON.parse(res.body) as { message?: string; error?: string }).message ?? reason; } catch { /* keep the generic text */ }
      lastError = reason;
      // A refusal will not change on a retry; a busy or timed-out server might.
      if (res.status < 500 && res.status !== 408 && res.status !== 429) break;
    } catch {
      lastError = 'The connection was too slow or dropped.';
    }
  }
  throw new Error(`${lastError} Please try again on a stronger connection.`);
}
