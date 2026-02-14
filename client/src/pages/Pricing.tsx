import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Pricing() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">格價功能</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            比較多個市場的卡牌價格,找到最佳交易機會
          </p>
          <Button
            onClick={() => toast.info("功能開發中,敬請期待!")}
            variant="default"
          >
            開始格價
          </Button>
        </div>
    </div>
  );
}
