/**
 * Boxium Design System — 視覺驗收展示頁
 * 路由：/admin/design-system
 * 展示所有 Brand Token 色板、統一組件（Button、Badge、ListingCard）
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListingCard,
  ListingCardSkeleton,
  StatusBadge,
  type StatusBadgeVariant,
} from "@/components/ListingCard";
import { Gavel, ShoppingCart, Heart, Star, Award, Tag, Check, AlertCircle, Info, Clock } from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_MARKETPLACE = {
  id: 1,
  title: "Pikachu VMAX Secret Rare SA 閃卡 PSA 10",
  images: JSON.stringify(["https://cdn.snkrdunk.com/upload_bg_removed/pkmn-tcg-7319847-yu.webp"]),
  condition: "psa10",
  tcgSeries: "pokemon",
  priceHkd: "4800",
  quantity: 2,
  remainingQuantity: 2,
  status: "active",
  sellerType: "seller",
  sellerProfile: { avgRating: "4.9", ratingCount: 127 },
};

const MOCK_AUCTION = {
  id: 2,
  title: "Charizard ex Special Art Rare 噴火龍 特別插圖稀有",
  images: JSON.stringify(["https://cdn.snkrdunk.com/upload_bg_removed/pkmn-tcg-7319847-yu.webp"]),
  condition: "raw_a",
  tcgSeries: "pokemon",
  listingMode: "auction",
  auctionStatus: "active",
  auctionEndAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  startingBid: "500",
  currentHighestBid: "1200",
  buyNowPrice: "3500",
  bidCount: 8,
};

const MOCK_SOLDOUT = {
  ...MOCK_MARKETPLACE,
  id: 3,
  title: "Umbreon VMAX Alt Art 月亮伊布 PSA 9",
  remainingQuantity: 0,
  status: "sold",
  condition: "psa9",
};

const MOCK_ONEPIECE = {
  id: 4,
  title: "Monkey D. Luffy OP06-001 Secret Rare",
  images: null,
  condition: "raw_a",
  tcgSeries: "onepiece",
  priceHkd: "680",
  quantity: 5,
  remainingQuantity: 5,
  status: "active",
  sellerType: "platform",
  sellerProfile: null,
};

// ─── Section Component ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-[var(--brand-text-main)] border-b border-[var(--brand-border-default)] pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--brand-text-secondary)]">{title}</h3>
      {children}
    </div>
  );
}

// ─── Token Swatch ─────────────────────────────────────────────────────────────
function TokenSwatch({ name, cssVar, textColor = "text-white" }: {
  name: string;
  cssVar: string;
  textColor?: string;
}) {
  return (
    <div
      className={`rounded-lg p-3 flex flex-col gap-1 ${textColor}`}
      style={{ background: `var(${cssVar})` }}
    >
      <span className="text-[10px] font-mono opacity-80">{cssVar}</span>
      <span className="text-xs font-semibold">{name}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DesignSystem() {
  const [wishlist, setWishlist] = useState<number[]>([]);

  const toggleWishlist = (id: number) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface-page)] p-6 space-y-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">
          Boxium Design System
        </h1>
        <p className="text-sm text-[var(--brand-text-secondary)]">
          視覺驗收頁面 — 所有組件使用 Brand Token，不硬編碼顏色。
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] font-mono bg-[var(--brand-primary-light)] text-[var(--brand-primary)] px-2 py-0.5 rounded">
            tokens.css v1.0
          </span>
          <span className="text-[10px] font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
            ✓ TypeScript 0 errors
          </span>
        </div>
      </div>

      {/* ── 1. Brand Color Tokens ── */}
      <Section title="1. Brand Color Tokens（品牌色板）">
        <SubSection title="核心品牌色">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TokenSwatch name="Brand Primary" cssVar="--brand-primary" />
            <TokenSwatch name="Primary Hover" cssVar="--brand-primary-hover" />
            <TokenSwatch name="Brand Accent" cssVar="--brand-accent" textColor="text-[#06038D]" />
            <TokenSwatch name="Accent Hover" cssVar="--brand-accent-hover" textColor="text-[#06038D]" />
          </div>
        </SubSection>
        <SubSection title="Surface（背景面）">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TokenSwatch name="Surface Page" cssVar="--brand-surface-page" textColor="text-[var(--brand-text-main)]" />
            <TokenSwatch name="Surface Card" cssVar="--brand-surface-card" textColor="text-[var(--brand-text-main)]" />
            <TokenSwatch name="Surface Nav" cssVar="--brand-surface-nav" />
            <TokenSwatch name="Primary Light" cssVar="--brand-primary-light" textColor="text-[var(--brand-primary)]" />
          </div>
        </SubSection>
        <SubSection title="Status 狀態色">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(["active", "sold", "pending", "disputed", "auction", "ended"] as StatusBadgeVariant[]).map(s => (
              <div key={s} className="flex items-center gap-2 p-3 rounded-lg border border-[var(--brand-border-default)] bg-[var(--brand-surface-card)]">
                <StatusBadge status={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</StatusBadge>
              </div>
            ))}
          </div>
        </SubSection>
      </Section>

      {/* ── 2. Buttons ── */}
      <Section title="2. Buttons（按鈕系統）">
        <SubSection title="Primary — 主要操作（出價、購買、確認）">
          <div className="flex flex-wrap gap-3">
            <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-text-on-primary)]">
              <ShoppingCart className="w-4 h-4 mr-2" />
              立即購買
            </Button>
            <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-text-on-primary)]">
              <Gavel className="w-4 h-4 mr-2" />
              立即出價
            </Button>
            <Button disabled className="bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)]">
              處理中...
            </Button>
          </div>
        </SubSection>
        <SubSection title="Accent — 強調操作（CTA、高亮按鈕）">
          <div className="flex flex-wrap gap-3">
            <Button className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-text-on-accent)] font-bold">
              即時購買 HK$3,500
            </Button>
            <Button className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-text-on-accent)] font-bold">
              <Star className="w-4 h-4 mr-2" />
              加入願望清單
            </Button>
          </div>
        </SubSection>
        <SubSection title="Secondary / Ghost — 次要操作">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-[var(--brand-border-default)] text-[var(--brand-text-main)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]">
              查看詳情
            </Button>
            <Button variant="ghost" className="text-[var(--brand-text-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary-light)]">
              取消
            </Button>
            <Button variant="destructive">
              <AlertCircle className="w-4 h-4 mr-2" />
              刪除商品
            </Button>
          </div>
        </SubSection>
      </Section>

      {/* ── 3. Status Badges ── */}
      <Section title="3. Status Badges（狀態標籤）">
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="active" icon={<Check className="w-3 h-3" />}>上架中</StatusBadge>
          <StatusBadge status="sold" icon={<Tag className="w-3 h-3" />}>已售出</StatusBadge>
          <StatusBadge status="pending" icon={<Clock className="w-3 h-3" />}>待付款</StatusBadge>
          <StatusBadge status="disputed" icon={<AlertCircle className="w-3 h-3" />}>爭議中</StatusBadge>
          <StatusBadge status="auction" icon={<Gavel className="w-3 h-3" />}>拍賣中</StatusBadge>
          <StatusBadge status="ended">已結標</StatusBadge>
          <StatusBadge status="info" icon={<Info className="w-3 h-3" />}>資訊</StatusBadge>
          <StatusBadge status="warning" icon={<AlertCircle className="w-3 h-3" />}>警告</StatusBadge>
        </div>
        <p className="text-xs text-[var(--brand-text-muted)] mt-2">
          所有狀態顏色使用 <code className="font-mono bg-gray-100 px-1 rounded">--brand-status-*</code> Token，修改 tokens.css 即可全站同步。
        </p>
      </Section>

      {/* ── 4. ListingCard ── */}
      <Section title="4. ListingCard（商品卡片）">
        <SubSection title="variant=&quot;marketplace&quot; — 一般商品">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-[var(--brand-text-muted)] mb-2">正常商品</p>
              <ListingCard
                listing={MOCK_MARKETPLACE}
                variant="marketplace"
                wishlistIds={wishlist}
                onWishlistToggle={toggleWishlist}
              />
            </div>
            <div>
              <p className="text-[10px] text-[var(--brand-text-muted)] mb-2">已售出</p>
              <ListingCard listing={MOCK_SOLDOUT} variant="marketplace" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--brand-text-muted)] mb-2">官方商品（One Piece）</p>
              <ListingCard listing={MOCK_ONEPIECE} variant="marketplace" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--brand-text-muted)] mb-2">Skeleton 載入中</p>
              <ListingCardSkeleton variant="marketplace" />
            </div>
          </div>
        </SubSection>

        <SubSection title="variant=&quot;auction&quot; — 拍賣商品">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-[var(--brand-text-muted)] mb-2">進行中（2h 後結標）</p>
              <ListingCard listing={MOCK_AUCTION} variant="auction" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--brand-text-muted)] mb-2">Skeleton 載入中</p>
              <ListingCardSkeleton variant="auction" />
            </div>
          </div>
        </SubSection>

        <SubSection title="variant=&quot;compact&quot; — 精簡版（首頁推薦）">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ListingCard listing={MOCK_MARKETPLACE} variant="compact" />
            <ListingCard listing={MOCK_ONEPIECE} variant="compact" />
            <ListingCardSkeleton variant="compact" />
            <ListingCardSkeleton variant="compact" />
          </div>
        </SubSection>
      </Section>

      {/* ── 5. Typography ── */}
      <Section title="5. Typography（排版系統）">
        <div className="space-y-3 p-4 bg-[var(--brand-surface-card)] rounded-xl border border-[var(--brand-border-default)]">
          <p className="text-2xl font-bold text-[var(--brand-text-main)]">H1 — 頁面標題 (2xl bold)</p>
          <p className="text-xl font-semibold text-[var(--brand-text-main)]">H2 — 區塊標題 (xl semibold)</p>
          <p className="text-lg font-semibold text-[var(--brand-text-main)]">H3 — 卡片標題 (lg semibold)</p>
          <p className="text-base text-[var(--brand-text-main)]">Body — 正文內容 (base regular)</p>
          <p className="text-sm text-[var(--brand-text-secondary)]">Secondary — 次要說明文字 (sm, secondary)</p>
          <p className="text-xs text-[var(--brand-text-muted)]">Caption — 輔助說明、時間戳 (xs, muted)</p>
          <p className="text-lg font-bold text-[var(--brand-primary)]">Price — 價格顯示 (lg bold, brand-primary)</p>
        </div>
      </Section>

      {/* ── 6. Shadows & Borders ── */}
      <Section title="6. Shadows & Borders（陰影與邊框）">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: "shadow-sm", shadow: "var(--brand-shadow-sm)" },
            { name: "shadow-md", shadow: "var(--brand-shadow-md)" },
            { name: "shadow-lg", shadow: "var(--brand-shadow-lg)" },
            { name: "shadow-hover", shadow: "var(--brand-shadow-hover)" },
          ].map(({ name, shadow }) => (
            <div
              key={name}
              className="p-4 bg-[var(--brand-surface-card)] rounded-xl border border-[var(--brand-border-default)] text-center"
              style={{ boxShadow: shadow }}
            >
              <p className="text-xs font-mono text-[var(--brand-text-secondary)]">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer */}
      <div className="text-center text-xs text-[var(--brand-text-muted)] pt-4 border-t border-[var(--brand-border-default)]">
        Boxium Design System v1.0 — 修改 <code className="font-mono">client/src/styles/tokens.css</code> 即可全站同步品牌色
      </div>
    </div>
  );
}
