import { useEffect, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        onClick={onClose}
        aria-label="關閉"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Image */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          style={{ userSelect: "none" }}
        />
      </div>

      {/* Hint */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
        點擊任意位置或按 Esc 關閉
      </p>
    </div>
  );
}

interface ClickableImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick: () => void;
}

export function ClickableCardImage({ src, alt, className, style, onClick }: ClickableImageProps) {
  return (
    <div className="relative group cursor-zoom-in" onClick={onClick}>
      <img src={src} alt={alt} className={className} style={style} />
      {/* Zoom hint overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl bg-black/20">
        <div className="bg-black/60 backdrop-blur-sm rounded-full p-2">
          <ZoomIn className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
