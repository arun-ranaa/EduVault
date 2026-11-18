import React, { useState, useEffect, useCallback } from 'react';
import {
  HiOutlineEye,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowDownTray,
  HiOutlineMagnifyingGlassPlus,
  HiOutlineMagnifyingGlassMinus,
  HiOutlineArrowPath,
  HiOutlineDocumentText,
  HiOutlineMusicalNote,
  HiOutlineExclamationTriangle,
  HiXMark,
} from 'react-icons/hi2';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus']);
const PDF_EXTENSIONS = new Set(['pdf']);

const getExtension = (fileName = '') => {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const detectPreviewKind = (fileName, fileType) => {
  const ext = getExtension(fileName);
  if (ext) {
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
    if (PDF_EXTENSIONS.has(ext)) return 'pdf';
    return 'unsupported';
  }

  const mime = String(fileType || '').toLowerCase();
  if (mime.startsWith('image/') && !mime.includes('heic') && !mime.includes('heif') && !mime.includes('tiff') && !mime.includes('svg')) {
    return 'image';
  }
  if (mime === 'video/mp4' || mime === 'video/webm' || mime === 'video/quicktime' || mime === 'video/ogg') {
    return 'video';
  }
  if (mime.startsWith('audio/') && !mime.includes('wma') && !mime.includes('amr') && !mime.includes('aiff')) {
    return 'audio';
  }
  if (mime === 'application/pdf') {
    return 'pdf';
  }
  return 'unsupported';
};

/**
 * Reusable inline file preview component for ResourceDetailPage and VaultFileDetailPage.
 * Streams media directly from Amazon S3 via short-lived inline pre-signed URLs.
 */
const FilePreview = ({ fileName, fileType, fetchPreviewUrl, onDownload }) => {
  const previewKind = detectPreviewKind(fileName, fileType);
  const ext = getExtension(fileName);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [error, setError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);

  const loadPreview = useCallback(async (isCancelledRef) => {
    if (previewKind === 'unsupported' || typeof fetchPreviewUrl !== 'function') {
      return;
    }

    setLoadingUrl(true);
    setMediaReady(false);
    setError('');

    try {
      const res = await fetchPreviewUrl();
      const url = res?.data?.data?.previewUrl || res?.data?.previewUrl;
      if (!url) {
        throw new Error('Preview URL was not returned by server');
      }
      if (!isCancelledRef.current) {
        setPreviewUrl(url);
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        setError(err?.response?.data?.message || 'Unable to load preview right now.');
      }
    } finally {
      if (!isCancelledRef.current) {
        setLoadingUrl(false);
      }
    }
  }, [fetchPreviewUrl, previewKind]);

  useEffect(() => {
    const isCancelledRef = { current: false };
    setPreviewUrl(null);
    setLightboxOpen(false);
    setZoomed(false);
    loadPreview(isCancelledRef);
    return () => {
      isCancelledRef.current = true;
    };
  }, [loadPreview, retryCounter]);

  // Close fullscreen lightbox on Escape key
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  const handleRetry = () => {
    setRetryCounter((c) => c + 1);
  };

  if (previewKind === 'unsupported') {
    return (
      <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
        <HiOutlineDocumentText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">
          In-browser preview is not available for{' '}
          <span className="uppercase font-semibold">{ext ? `.${ext}` : 'this'}</span> files
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Use the Download button to open this file on your device.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
        {/* Preview Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <HiOutlineEye className="w-4 h-4 text-primary-600" />
            <span>
              {previewKind === 'image' && 'Image Preview'}
              {previewKind === 'video' && 'Video Preview'}
              {previewKind === 'audio' && 'Audio Preview'}
              {previewKind === 'pdf' && 'PDF Preview'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {previewKind === 'image' && previewUrl && !error && (
              <button
                type="button"
                onClick={() => { setZoomed(false); setLightboxOpen(true); }}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-primary-600 transition-colors"
              >
                <HiOutlineMagnifyingGlassPlus className="w-4 h-4" />
                Fullscreen
              </button>
            )}
            {previewUrl && !error && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                <HiOutlineArrowTopRightOnSquare className="w-4 h-4" />
                Open in New Tab
              </a>
            )}
          </div>
        </div>

        {/* Preview Body */}
        <div className="p-4">
          {loadingUrl && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading preview...</p>
            </div>
          )}

          {!loadingUrl && error && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <HiOutlineExclamationTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-sm font-medium text-gray-800 mb-1">{error}</p>
              <p className="text-xs text-gray-500 mb-4 max-w-md">
                Your browser may not support this file&apos;s codec or the preview link may have expired.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <HiOutlineArrowPath className="w-4 h-4" />
                  Retry Preview
                </button>
                {onDownload && (
                  <button
                    type="button"
                    onClick={onDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <HiOutlineArrowDownTray className="w-4 h-4" />
                    Download File
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Image Preview */}
          {!loadingUrl && !error && previewUrl && previewKind === 'image' && (
            <div className="relative flex flex-col items-center justify-center min-h-[200px] bg-gray-100/80 rounded-lg p-2">
              {!mediaReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <img
                src={previewUrl}
                alt={fileName || 'File preview'}
                onLoad={() => setMediaReady(true)}
                onError={() => setError('Failed to render this image in the browser.')}
                onClick={() => { setZoomed(false); setLightboxOpen(true); }}
                className={`max-h-[70vh] max-w-full w-auto object-contain rounded cursor-zoom-in transition-opacity duration-200 ${
                  mediaReady ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {mediaReady && (
                <p className="text-xs text-gray-400 mt-2">Click image to view fullscreen</p>
              )}
            </div>
          )}

          {/* Video Preview (Direct S3 HTTP Byte-Range Streaming) */}
          {!loadingUrl && !error && previewUrl && previewKind === 'video' && (
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                playsInline
                preload="metadata"
                onError={() => setError('This video codec cannot be played directly in your browser.')}
                className="w-full max-h-[70vh] outline-none"
              >
                Your browser does not support HTML5 video playback.
              </video>
            </div>
          )}

          {/* Audio Preview */}
          {!loadingUrl && !error && previewUrl && previewKind === 'audio' && (
            <div className="flex flex-col items-center gap-4 py-6 px-4 bg-white rounded-lg border border-gray-100">
              <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
                <HiOutlineMusicalNote className="w-7 h-7 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-gray-800 truncate max-w-full">{fileName}</p>
              <audio
                key={previewUrl}
                src={previewUrl}
                controls
                preload="metadata"
                onError={() => setError('This audio format cannot be played directly in your browser.')}
                className="w-full max-w-lg"
              >
                Your browser does not support HTML5 audio playback.
              </audio>
            </div>
          )}

          {/* PDF Preview */}
          {!loadingUrl && !error && previewUrl && previewKind === 'pdf' && (
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              <iframe
                src={previewUrl}
                title={fileName || 'PDF Preview'}
                className="w-full h-[70vh] border-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxOpen && previewKind === 'image' && previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => { setLightboxOpen(false); setZoomed(false); }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 bg-black/60 text-white border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium truncate max-w-[60%]">{fileName}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
                title={zoomed ? 'Fit to screen' : 'Zoom to actual size'}
              >
                {zoomed ? (
                  <>
                    <HiOutlineMagnifyingGlassMinus className="w-4 h-4" />
                    Fit
                  </>
                ) : (
                  <>
                    <HiOutlineMagnifyingGlassPlus className="w-4 h-4" />
                    Zoom
                  </>
                )}
              </button>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-xs font-medium transition-colors"
                >
                  <HiOutlineArrowDownTray className="w-4 h-4" />
                  Download
                </button>
              )}
              <button
                type="button"
                onClick={() => { setLightboxOpen(false); setZoomed(false); }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close fullscreen preview"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onClick={() => { setLightboxOpen(false); setZoomed(false); }}
          >
            <img
              src={previewUrl}
              alt={fileName || 'Fullscreen preview'}
              onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
              className={
                zoomed
                  ? 'max-w-none max-h-none cursor-zoom-out'
                  : 'max-h-[85vh] max-w-[92vw] object-contain cursor-zoom-in'
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePreview;
