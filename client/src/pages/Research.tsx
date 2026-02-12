import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Research() {
  return (
    <MainLayout>
      <div className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">研究功能</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            深入分析卡牌市場趨勢、價格走勢與投資建議
          </p>
          <Button
            onClick={() => toast.info("功能開發中,敬請期待!")}
            variant="default"
          >
            探索研究工具
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
