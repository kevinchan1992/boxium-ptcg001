import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  const { t } = useTranslation();
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

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 100000,
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.15)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label={t("common.close")}
      >
        <X size={20} />
      </button>

      {/* Image — stop propagation so clicking the image itself doesn't close */}
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: "0.75rem",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
          userSelect: "none",
          pointerEvents: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Hint */}
      <p
        style={{
          position: "absolute",
          bottom: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.75rem",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {t("imageLightbox.closeHint")}
      </p>
    </div>,
    document.body
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
    <div className="relative group cursor-zoom-in h-full w-full" onClick={onClick}>
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
