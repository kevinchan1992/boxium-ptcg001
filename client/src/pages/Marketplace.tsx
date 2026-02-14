import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Marketplace() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">交易市場</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            安全的卡牌交易平台,支援拍賣、報價與議價功能
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => toast.info("功能開發中,敬請期待!")}
              variant="default"
            >
              瀏覽拍賣
            </Button>
            <Button
              onClick={() => toast.info("功能開發中,敬請期待!")}
              variant="outline"
            >
              發布商品
            </Button>
          </div>
        </div>
    </div>
  );
}
