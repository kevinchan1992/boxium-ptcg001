import { useState } from "react";
import { useRoute } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Sample data for demonstration
const sampleCard = {
  id: 1,
  name: "Japanese MEGA Charizard X ex",
  series: "Expansion Pack Inferno X",
  cardNumber: "110",
  imageUrl: "https://images.pokemontcg.io/xy2/108_hires.png",
  rarity: "HR (Hyper Rare)",
  language: "日文",
  releaseDate: "2025年3月15日",
  artist: "5ban Graphics",
  description: "這張於2025年發行的噴火龍X ex M2：Inferno X 110/80，迅速成為了收藏界的新寵，其獨特的卡面設計和對噴火龍經典形象的重新演繹，讓它在發行之初就吸引了全球訓練家及收藏家的目光。",
  referencePrice: "HKD $5,909",
};

const priceData = [
  { time: "4 小時前", price: "HKD $5,954" },
  { time: "4 小時前", price: "HKD $6,005" },
  { time: "4 小時前", price: "HKD $5,914" },
  { time: "4 小時前", price: "HKD $5,863" },
  { time: "6 小時前", price: "HKD $5,863" },
  { time: "6 小時前", price: "HKD $5,761" },
  { time: "9 小時前", price: "HKD $5,812" },
  { time: "12 小時前", price: "HKD $5,965" },
  { time: "15 小時前", price: "HKD $5,914" },
  { time: "16 小時前", price: "HKD $5,903" },
];

const gradeDistribution = [
  { company: "PSA", total: 26681, highest: 23382, percentage: "87.6%" },
  { company: "BGS", total: 1847, highest: 1701, percentage: "92.1%" },
];

const grades = ["PSA 10", "BGS BL", "BGS 10", "ARS 10+", "ARS 10"];

export default function CardDetail() {
  const [, params] = useRoute("/card/:id");
  const [activeSource, setActiveSource] = useState<"snkr" | "ebay">("snkr");
  const [activeGrade, setActiveGrade] = useState<string | null>(null);

  return (
    <MainLayout>
      <div className="min-h-screen py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {sampleCard.name}
          </h1>
          <div className="flex gap-2">
            <Button variant="default" size="sm">
              格價
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Card Image */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <img
                src={sampleCard.imageUrl}
                alt={sampleCard.name}
                className="w-full rounded-lg shadow-2xl"
              />
            </div>
          </div>

          {/* Right Column - Card Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Source and Grade Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeSource === "snkr" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("snkr")}
              >
                SNKR
              </Button>
              <Button
                variant={activeSource === "ebay" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("ebay")}
              >
                eBay
              </Button>
              <div className="w-px h-8 bg-border mx-2" />
              {grades.map((grade) => (
                <Button
                  key={grade}
                  variant={activeGrade === grade ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveGrade(activeGrade === grade ? null : grade)}
                >
                  {grade}
                </Button>
              ))}
            </div>

            {/* Reference Price */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-2xl font-bold text-foreground">
                參考價格: {sampleCard.referencePrice}
              </h2>
            </div>

            {/* Price History Table */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  SNKRDUNK 上的最近交易
                </h3>
                <a
                  href="#"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  來源
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody className="divide-y divide-border">
                    {priceData.map((item, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="py-3 text-muted-foreground">{item.time}</td>
                        <td className="py-3 text-right font-medium text-foreground">
                          {item.price}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grade Distribution */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">評級分佈</h3>
                <a
                  href="#"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  來源
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-muted-foreground font-medium">
                        評級機構
                      </th>
                      <th className="text-right py-3 text-muted-foreground font-medium">
                        總評級數量
                      </th>
                      <th className="text-right py-3 text-muted-foreground font-medium">
                        最高等級數量
                      </th>
                      <th className="text-right py-3 text-muted-foreground font-medium">
                        百分比 (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {gradeDistribution.map((item, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="py-3 text-foreground">{item.company}</td>
                        <td className="py-3 text-right text-foreground">
                          {item.total.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-foreground">
                          {item.highest.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-foreground">
                          {item.percentage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card Summary */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                卡片摘要
              </h3>
              <p className="text-foreground leading-relaxed">
                {sampleCard.description}
              </p>
            </div>

            {/* Basic Information */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                基本資料
              </h3>
              <dl className="space-y-3">
                <div className="flex">
                  <dt className="text-muted-foreground w-32">主角/卡面主題:</dt>
                  <dd className="text-foreground">{sampleCard.name}</dd>
                </div>
                <div className="flex">
                  <dt className="text-muted-foreground w-32">所屬系列:</dt>
                  <dd className="text-foreground">{sampleCard.series}</dd>
                </div>
                <div className="flex">
                  <dt className="text-muted-foreground w-32">語言版本:</dt>
                  <dd className="text-foreground">{sampleCard.language}</dd>
                </div>
                <div className="flex">
                  <dt className="text-muted-foreground w-32">發行日期:</dt>
                  <dd className="text-foreground">{sampleCard.releaseDate}</dd>
                </div>
                <div className="flex">
                  <dt className="text-muted-foreground w-32">卡牌編號:</dt>
                  <dd className="text-foreground">{sampleCard.cardNumber}</dd>
                </div>
                <div className="flex">
                  <dt className="text-muted-foreground w-32">稀有度:</dt>
                  <dd className="text-foreground">{sampleCard.rarity}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
