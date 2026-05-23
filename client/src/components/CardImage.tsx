import React from "react";
import { getProxiedImageUrl } from "@/lib/utils";

interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  alt?: string;
}

/**
 * A drop-in replacement for <img> that automatically proxies
 * CDN URLs (e.g. cdn.snkrdunk.com) through our server to bypass
 * hotlink protection. All other props are forwarded to <img>.
 */
export function CardImage({ src, alt = "", ...props }: CardImageProps) {
  const proxied = getProxiedImageUrl(src);
  if (!proxied) return null;
  return <img src={proxied} alt={alt} {...props} />;
}
