import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Facebook, Twitter, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonProps {
  cardName: string;
  cardId: number;
}

export function ShareButton({ cardName, cardId }: ShareButtonProps) {
  const shareUrl = `${window.location.origin}/card/${cardId}`;
  const shareText = `查看 ${cardName} 的價格趨勢和市場數據 - BOXIUM PTCG`;

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, "_blank", "width=600,height=400");
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("連結已複製到剪貼板");
    } catch (error) {
      toast.error("複製失敗，請手動複製");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          分享
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleShareFacebook}>
          <Facebook className="h-4 w-4 mr-2" />
          分享到 Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareTwitter}>
          <Twitter className="h-4 w-4 mr-2" />
          分享到 Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <LinkIcon className="h-4 w-4 mr-2" />
          複製連結
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
