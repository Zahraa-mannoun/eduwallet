import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getFreshAccessToken } from '../services/api';

const LOG_PREFIX = '[useAuthenticatedImage]';

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

export type PreviewFileKind = 'image' | 'pdf' | 'unsupported';

type AuthenticatedImageResult = {
  // Only meaningful once fileKind === 'image'.
  resolvedUri: string | null;
  // null while the Content-Type check is still in flight.
  fileKind: PreviewFileKind | null;
  hasFetchError: boolean;
  errorMessage: string | null;
  // A version of uri with the token attached as a query param instead of a header — for handing
  // to Linking.openURL() (a PDF opened in the device's own viewer/browser) or anything else that
  // can't attach a custom Authorization header. Mirrors the backend's authenticate() fallback.
  externalUrl: string | null;
  // react-native-web's <Image> can't attach custom headers to the underlying <img> request the
  // way native iOS/Android can — that's why this hook does its own fetch()+blob() on web only.
  // On native, the caller passes these straight through to <Image source={{uri, headers}}>.
  nativeHeaders: Record<string, string> | undefined;
  // Whether the one-time native <Image> retry (see retryWithFreshToken) has already been used —
  // once true, a second onError means the request genuinely failed, not just a stale token.
  hasRetriedNative: boolean;
  retryWithFreshToken: () => void;
};

function buildExternalUrl(uri: string, token: string | null | undefined): string {
  if (!token) return uri;
  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}token=${encodeURIComponent(token)}`;
}

// Fetches a backend-protected file (a KYC document — image OR PDF — or a withdrawal receipt,
// always an image) behind a Bearer token, and figures out how it should even be previewed before
// trying: KYC documents accept application/pdf as well as JPG/PNG (kyc.controller.ts's
// ALLOWED_KYC_MIME_TYPES), and a PDF handed to <Image> just fails to decode with no useful
// signal about why. So detection always checks the real Content-Type header first — a HEAD
// request on native (no point downloading a PDF's bytes just to discover it isn't an image), or
// inspecting headers off the one GET web already needs for its blob-URL workaround.
//
// Both platforms also share one failure mode worth handling explicitly: the token handed in was
// read from storage, not guaranteed fresh, and a 15-minute-old session (CLAUDE.md) is completely
// ordinary for "open a screen, look at a document a while later" — so both paths get exactly one
// retry with services/api.ts's getFreshAccessToken() (the same pattern reportService.ts already
// uses for its own direct, non-apiRequest file fetch) before giving up.
export function useAuthenticatedImage(
  uri: string | null,
  authToken?: string | null
): AuthenticatedImageResult {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<PreviewFileKind | null>(null);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null | undefined>(authToken);
  const [hasRetriedNative, setHasRetriedNative] = useState(false);
  const nativeRetryInFlight = useRef(false);

  // A new uri or a freshly-fetched authToken means a clean slate — most commonly, the preview
  // was closed and reopened for a different document.
  useEffect(() => {
    setCurrentToken(authToken);
    setHasRetriedNative(false);
    nativeRetryInFlight.current = false;
  }, [uri, authToken]);

  useEffect(() => {
    if (!uri) {
      setResolvedUri(null);
      setFileKind(null);
      setHasFetchError(false);
      setErrorMessage(null);
      return;
    }

    if (!authToken) {
      // Local, not-yet-uploaded file (e.g. EmailChangeRequestScreen's pendingProof) — nothing
      // to detect a Content-Type for, and both current callers of this path only ever hand it
      // a freshly-picked JPG/PNG.
      setResolvedUri(uri);
      setFileKind('image');
      setHasFetchError(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setResolvedUri(null);
    setFileKind(null);
    setHasFetchError(false);
    setErrorMessage(null);

    const fail = (message: string, logArgs: unknown) => {
      console.error(`${LOG_PREFIX} ${message}`, logArgs);
      if (!cancelled) {
        setHasFetchError(true);
        setErrorMessage(message);
      }
    };

    const resolveAsImage = async (token: string): Promise<void> => {
      if (Platform.OS !== 'web') {
        // Native already confirmed the Content-Type via HEAD — <Image> does its own fetch
        // with nativeHeaders below, no need to download the bytes here too.
        setResolvedUri(uri);
        setFileKind('image');
        return;
      }
      try {
        const res = await fetch(uri, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          fail(`Couldn't load this file (HTTP ${res.status}).`, { uri, status: res.status });
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        console.log(`${LOG_PREFIX} loaded image blob`, { uri, type: blob.type, size: blob.size });
        objectUrl = URL.createObjectURL(blob);
        setResolvedUri(objectUrl);
        setFileKind('image');
      } catch (err) {
        fail('Could not read the image data.', { uri, err });
      }
    };

    const detect = async (token: string, isRetry: boolean): Promise<void> => {
      console.log(`${LOG_PREFIX} checking file type (${isRetry ? 'retry with fresh token' : 'first attempt'}):`, uri);

      let res: Response;
      try {
        // HEAD is enough to read Content-Type without downloading the body — Fastify exposes a
        // HEAD route for every GET route by default, so this hits the same handler for free.
        // Web still needs the full GET eventually (for the blob-URL workaround), but checking
        // Content-Type via HEAD first means a web PDF never gets its bytes downloaded for
        // nothing either.
        res = await fetch(uri, { method: 'HEAD', headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        fail('Could not reach the server.', { uri, err });
        return;
      }

      if (res.status === 401 && !isRetry) {
        console.warn(`${LOG_PREFIX} got 401 on first attempt — refreshing token and retrying once`, uri);
        const freshToken = await getFreshAccessToken();
        if (cancelled) return;
        if (!freshToken) {
          fail('Your session expired. Please log in again.', { uri });
          return;
        }
        setCurrentToken(freshToken);
        return detect(freshToken, true);
      }

      if (!res.ok) {
        fail(`Couldn't load this file (HTTP ${res.status}).`, { uri, status: res.status });
        return;
      }

      const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      console.log(`${LOG_PREFIX} detected content-type`, { uri, contentType });

      if (contentType === 'application/pdf') {
        if (!cancelled) setFileKind('pdf');
        return;
      }

      if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
        console.error(`${LOG_PREFIX} unsupported content-type`, { uri, contentType });
        if (!cancelled) {
          setFileKind('unsupported');
          setErrorMessage(
            contentType ? `This file type (${contentType}) can't be previewed.` : "This file can't be previewed."
          );
        }
        return;
      }

      await resolveAsImage(token);
    };

    void detect(authToken, false);

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, authToken]);

  const retryWithFreshToken = useCallback(() => {
    if (Platform.OS === 'web' || hasRetriedNative || nativeRetryInFlight.current) return;
    nativeRetryInFlight.current = true;
    console.warn(`${LOG_PREFIX} native <Image> failed to load — refreshing token and retrying once`, uri);
    void getFreshAccessToken().then((freshToken) => {
      nativeRetryInFlight.current = false;
      setHasRetriedNative(true);
      if (freshToken) {
        setCurrentToken(freshToken);
      } else {
        console.error(`${LOG_PREFIX} token refresh failed during native retry, giving up`, uri);
      }
    });
  }, [uri, hasRetriedNative]);

  const nativeHeaders =
    Platform.OS !== 'web' && currentToken ? { Authorization: `Bearer ${currentToken}` } : undefined;
  const externalUrl = uri ? buildExternalUrl(uri, currentToken) : null;

  return {
    resolvedUri,
    fileKind,
    hasFetchError,
    errorMessage,
    externalUrl,
    nativeHeaders,
    hasRetriedNative,
    retryWithFreshToken,
  };
}
