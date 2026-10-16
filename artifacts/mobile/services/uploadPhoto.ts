import * as ImageManipulator from 'expo-image-manipulator';
import { parseApiError, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

/** Widest side we keep. A phone photo is 4000 px and several MB; the order only needs a clear reference picture. */
const MAX_SIDE = 1600;
const UPLOAD_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

/**
 * Shrinks a phone photo and uploads it to a public storage bucket, then returns its public link.
 *
 * Full-size photos over a mobile connection were running past the app's 20 s request limit, so the upload was
 * cancelled ("Aborted") or the storage service timed out, and the order could not be completed. This resizes first
 * (a few hundred KB instead of several MB), allows 60 s, and tries up to 3 times on a timeout or server error.
 */
export async function uploadPhoto({
  uri,
  bucket,
  folder,
  token,
}: {
  uri: string;
  bucket: string;
  /** The user's own folder inside the bucket, e.g. their auth id. */
  folder: string;
  token: string;
}): Promise<string> {
  let blob: Blob;
  try {
    const small = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_SIDE } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );
    blob = await (await fetch(small.uri)).blob();
  } catch {
    // Could not resize (rare): send the original rather than fail.
    blob = await (await fetch(uri)).blob();
  }

  const path = `${folder}/photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  let lastError = 'The upload did not finish.';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise<void>(r => setTimeout(r, 1200 * (attempt - 1)));
    try {
      const res = await supabaseFetch(
        `/storage/v1/object/${bucket}/${path}`,
        { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: blob },
        token,
        UPLOAD_TIMEOUT_MS,
      );
      if (res.ok) return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      lastError = await parseApiError(res);
      // A refusal (not allowed, too large) will not change on a retry; a busy or timed-out server will.
      if (res.status < 500 && res.status !== 408 && res.status !== 429) break;
    } catch {
      lastError = 'The connection was too slow.';
    }
  }
  throw new Error(`${lastError} Please check your connection and try again.`);
}
