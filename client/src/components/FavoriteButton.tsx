import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface FavoriteButtonProps {
  cardId: number;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showText?: boolean;
}

export function FavoriteButton({ 
  cardId, 
  variant = "outline", 
  size = "default",
  showText = true 
}: FavoriteButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Check if card is favorited
  const { data: favoriteStatus, isLoading } = trpc.favorites.isFavorited.useQuery(
    { cardId },
    { enabled: !!user }
  );

  const isFavorited = favoriteStatus?.isFavorited || false;

  // Add to favorites mutation
  const addMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      toast.success(t("favorites.added"));
      // Invalidate queries to refresh UI
      utils.favorites.isFavorited.invalidate({ cardId });
      utils.favorites.list.invalidate();
    },
    onError: (error) => {
      toast.error(t("favorites.addError") + ": " + error.message);
    },
  });

  // Remove from favorites mutation
  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      toast.success(t("favorites.removed"));
      // Invalidate queries to refresh UI
      utils.favorites.isFavorited.invalidate({ cardId });
      utils.favorites.list.invalidate();
    },
    onError: (error) => {
      toast.error(t("favorites.removeError") + ": " + error.message);
    },
  });

  const handleClick = () => {
    // Redirect to login if not authenticated
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }

    // Toggle favorite status
    if (isFavorited) {
      removeMutation.mutate({ cardId });
    } else {
      addMutation.mutate({ cardId });
    }
  };

  const isProcessing = addMutation.isPending || removeMutation.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading || isProcessing}
      className="gap-2"
    >
      <Heart
        className={`h-4 w-4 transition-all ${
          isFavorited ? "fill-red-500 text-red-500" : ""
        }`}
      />
      {showText && (
        <span>
          {isLoading
            ? t("common.loading")
            : isFavorited
            ? t("favorites.unfavorite")
            : t("favorites.favorite")}
        </span>
      )}
    </Button>
  );
}
