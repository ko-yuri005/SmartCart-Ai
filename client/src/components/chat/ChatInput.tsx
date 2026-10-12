import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Camera, X, AlertCircle } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onSendVisualSearch?: (params: {
    imageData: string;
    mimeType: string;
    fileName: string;
    userHint?: string;
    previewUrl: string;
  }) => void;
  isLoading: boolean;
  placeholder?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const PROXY_SAFE_RAW_BYTES = 2.2 * 1024 * 1024; // ~2.9 MB base64 (safely under Vercel 4.5 MB proxy cap)
const MAX_DIMENSION_PX = 1600;

function optimizeImageForProductionUpload(
  dataUrl: string,
  originalMimeType: string,
  originalByteSize: number
): Promise<{ dataUrl: string; mimeType: string }> {
  if (originalByteSize <= PROXY_SAFE_RAW_BYTES) {
    return Promise.resolve({ dataUrl, mimeType: originalMimeType });
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
          const scale = Math.min(MAX_DIMENSION_PX / width, MAX_DIMENSION_PX / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl, mimeType: originalMimeType });
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.86);
        if (compressedUrl && compressedUrl.startsWith('data:image/jpeg;base64,')) {
          resolve({ dataUrl: compressedUrl, mimeType: 'image/jpeg' });
        } else {
          resolve({ dataUrl, mimeType: originalMimeType });
        }
      } catch {
        resolve({ dataUrl, mimeType: originalMimeType });
      }
    };
    img.onerror = () => resolve({ dataUrl, mimeType: originalMimeType });
    img.src = dataUrl;
  });
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendVisualSearch,
  isLoading,
  placeholder = "Ask for products, compare options, or say 'Add the first one to my cart'...",
}) => {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{
    base64Data: string;
    mimeType: string;
    fileName: string;
    previewUrl: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError(
        `Unsupported image format (${file.type || 'unknown'}). Please upload a JPEG, PNG, or WebP photo.`
      );
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError('Image exceeds the 5 MB limit. Please choose a smaller photo.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setUploadError('Failed to read image file.');
        return;
      }
      const optimized = await optimizeImageForProductionUpload(
        result,
        file.type,
        file.size
      );
      setSelectedImage({
        base64Data: optimized.dataUrl,
        mimeType: optimized.mimeType,
        fileName: file.name,
        previewUrl: optimized.dataUrl,
      });
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (selectedImage && onSendVisualSearch) {
      onSendVisualSearch({
        imageData: selectedImage.base64Data,
        mimeType: selectedImage.mimeType,
        fileName: selectedImage.fileName,
        userHint: text.trim() || undefined,
        previewUrl: selectedImage.previewUrl,
      });
      setSelectedImage(null);
      setText('');
      setUploadError(null);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 sm:p-4 bg-[#FAF8F5] border-t border-[#E6E1D6]"
    >
      {/* Upload Error Alert */}
      {uploadError && (
        <div className="mb-2.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-600 hover:text-rose-900"
            aria-label="Dismiss upload error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Image Preview Bar */}
      {selectedImage && (
        <div className="mb-2.5 p-2.5 rounded-xl bg-white border border-[#254B3B]/30 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={selectedImage.previewUrl}
              alt={selectedImage.fileName}
              className="w-12 h-12 rounded-lg object-cover border border-[#E6E1D6] flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 truncate">
                {selectedImage.fileName}
              </p>
              <p className="text-[11px] text-zinc-500">
                Ready for AI visual product discovery • Add an optional hint below or press Send
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#E6E1D6] text-[11px] font-medium text-zinc-700"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              aria-label="Remove selected image"
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-white border border-[#E6E1D6] rounded-2xl px-3 py-2 focus-within:border-[#254B3B] focus-within:ring-2 focus-within:ring-[#DCE7D9] transition-all shadow-sm">
        {/* Hidden File Input for Image Discovery */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload product image for visual search"
        />

        {onSendVisualSearch && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            title="Upload product image (JPEG, PNG, WebP up to 5MB)"
            aria-label="Upload product photo"
            className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#DCE7D9]/40 border border-[#E6E1D6] hover:border-[#254B3B]/30 text-zinc-700 hover:text-[#254B3B] transition-colors flex-shrink-0"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedImage
              ? 'Optional: Add a brand, model, or category hint for this photo...'
              : placeholder
          }
          disabled={isLoading}
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-sm text-zinc-900 placeholder-zinc-400 leading-relaxed max-h-32 disabled:opacity-50 py-1"
        />

        <button
          type="submit"
          disabled={isLoading || (text.trim().length === 0 && !selectedImage)}
          aria-label="Send message"
          className="p-2 rounded-xl bg-[#254B3B] hover:bg-[#1d3d2f] disabled:bg-[#F3EFE6] disabled:text-zinc-400 text-white font-medium transition-colors flex-shrink-0 flex items-center justify-center shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex justify-between items-center px-1 mt-1.5 text-[11px] text-zinc-500">
        <span>Enter to send • Camera icon to search by product photo (JPEG/PNG/WebP)</span>
        <span className="text-zinc-500 font-medium hidden sm:inline">
          Verified Catalogue AI
        </span>
      </div>
    </form>
  );
};
