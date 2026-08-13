import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthenticatedImage } from '../hooks/useAuthenticatedImage';

type ImagePreviewModalProps = Readonly<{
  visible: boolean;
  // A local file uri (already viewable directly, e.g. a freshly-picked-but-not-yet-uploaded
  // file) needs no authToken. A backend-served uri (an already-submitted KYC document or
  // withdrawal receipt) does — pass the access token and this component fetches it correctly on
  // every platform (see useAuthenticatedImage).
  uri: string | null;
  authToken?: string | null;
  title?: string;
  onClose: () => void;
}>;

export default function ImagePreviewModal({
  visible,
  uri,
  authToken,
  title,
  onClose,
}: ImagePreviewModalProps) {
  const {
    resolvedUri,
    fileKind,
    hasFetchError,
    errorMessage,
    externalUrl,
    nativeHeaders,
    hasRetriedNative,
    retryWithFreshToken,
  } = useAuthenticatedImage(visible ? uri : null, authToken);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [hasRenderError, setHasRenderError] = useState(false);
  const [openPdfError, setOpenPdfError] = useState<string | null>(null);
  const hasError = hasFetchError || hasRenderError || fileKind === 'unsupported';

  // Every failure path lands here, from either platform's fetch-stage failure (see
  // useAuthenticatedImage's own logging) or a render-stage <Image> failure below — useful when a
  // preview looks broken and it's not obvious which stage actually failed.
  useEffect(() => {
    if (hasError) {
      console.error('[ImagePreviewModal] failed to display file', {
        uri,
        fileKind,
        hasFetchError,
        hasRenderError,
        errorMessage,
      });
    }
  }, [hasError, hasFetchError, hasRenderError, fileKind, errorMessage, uri]);

  useEffect(() => {
    setHasRenderError(false);
    setIsImageLoading(true);
    setOpenPdfError(null);
  }, [uri]);

  const handleOpenPdf = async () => {
    if (!externalUrl) return;
    setOpenPdfError(null);
    try {
      const canOpen = await Linking.canOpenURL(externalUrl);
      if (!canOpen) {
        console.error('[ImagePreviewModal] Linking.canOpenURL returned false', externalUrl);
        setOpenPdfError("Couldn't find an app to open this PDF.");
        return;
      }
      await Linking.openURL(externalUrl);
    } catch (err) {
      console.error('[ImagePreviewModal] Linking.openURL failed', externalUrl, err);
      setOpenPdfError('Could not open the PDF.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? 'Preview'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageWrap}>
          {fileKind === 'image' && resolvedUri && !hasError ? (
            <Image
              key={`${resolvedUri}-${hasRetriedNative}`}
              source={{ uri: resolvedUri, headers: nativeHeaders }}
              style={styles.image}
              resizeMode="contain"
              onLoadStart={() => setIsImageLoading(true)}
              onLoadEnd={() => setIsImageLoading(false)}
              onError={(event) => {
                console.error('[ImagePreviewModal] <Image> onError', {
                  uri: resolvedUri,
                  platform: Platform.OS,
                  nativeEvent: event.nativeEvent,
                });
                if (Platform.OS !== 'web' && !hasRetriedNative) {
                  // Give the one-time refreshed-token retry a chance before treating this as a
                  // real failure — see useAuthenticatedImage's retryWithFreshToken.
                  retryWithFreshToken();
                  return;
                }
                setIsImageLoading(false);
                setHasRenderError(true);
              }}
            />
          ) : null}

          {fileKind === 'pdf' ? (
            <View style={styles.pdfBox}>
              <View style={styles.pdfIconCircle}>
                <MaterialCommunityIcons name="file-pdf-box" size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.pdfTitle}>This document is a PDF</Text>
              <Text style={styles.pdfSubtitle}>Open it in your device&apos;s PDF viewer to see it.</Text>
              <TouchableOpacity style={styles.pdfOpenButton} activeOpacity={0.85} onPress={handleOpenPdf}>
                <MaterialCommunityIcons name="open-in-new" size={16} color="#0A0E14" />
                <Text style={styles.pdfOpenButtonText}>Open PDF</Text>
              </TouchableOpacity>
              {openPdfError ? <Text style={styles.pdfErrorText}>{openPdfError}</Text> : null}
            </View>
          ) : null}

          {fileKind === null && !hasError ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
          {fileKind === 'image' && resolvedUri && isImageLoading && !hasError ? (
            <ActivityIndicator size="large" color="#FFFFFF" style={styles.loadingOverlay} />
          ) : null}

          {hasError ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="image-off-outline" size={40} color="rgba(255,255,255,0.7)" />
              <Text style={styles.errorText}>{errorMessage ?? "Couldn't load this file"}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,14,20,0.96)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
  },
  errorBox: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  pdfBox: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pdfIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pdfTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pdfSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  pdfOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  pdfOpenButtonText: {
    color: '#0A0E14',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  pdfErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
});
