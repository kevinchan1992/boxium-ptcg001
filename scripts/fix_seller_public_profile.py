#!/usr/bin/env python3
"""Fix hardcoded Chinese strings in SellerPublicProfile.tsx"""

FILE = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerPublicProfile.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# Note: AuctionCountdown and ListingCard are sub-components that need useTranslation
# We need to add useTranslation to each sub-component

# First, fix the AuctionCountdown sub-component
old_auction_countdown = '''function AuctionCountdown({ endAt }: { endAt: Date | string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!endAt) return;
    const end = new Date(endAt).getTime();
    const update = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft("已結標"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}天 ${h}時`);
      else if (h > 0) setTimeLeft(`${h}時 ${m}分`);
      else setTimeLeft(`${m}分 ${s}秒`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endAt]);

  const isUrgent = endAt && (new Date(endAt).getTime() - Date.now()) < 3600000;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? "text-red-500" : "text-gray-500"}`}>
      <Clock className="w-3 h-3" />
      {timeLeft || "計算中..."}
    </span>
  );
}'''

new_auction_countdown = '''function AuctionCountdown({ endAt }: { endAt: Date | string | null }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!endAt) return;
    const end = new Date(endAt).getTime();
    const update = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft(t("sellerPublicProfile.auctionEnded")); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(t("sellerPublicProfile.timeLeftDH", { d, h }));
      else if (h > 0) setTimeLeft(t("sellerPublicProfile.timeLeftHM", { h, m }));
      else setTimeLeft(t("sellerPublicProfile.timeLeftMS", { m, s }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endAt, t]);

  const isUrgent = endAt && (new Date(endAt).getTime() - Date.now()) < 3600000;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? "text-red-500" : "text-gray-500"}`}>
      <Clock className="w-3 h-3" />
      {timeLeft || t("sellerPublicProfile.calculating")}
    </span>
  );
}'''

if old_auction_countdown in content:
    content = content.replace(old_auction_countdown, new_auction_countdown, 1)
    print("  ✓ Fixed AuctionCountdown sub-component")
else:
    print("  ✗ AuctionCountdown NOT FOUND")

# Fix ListingCard sub-component - add useTranslation and translate conditionLabel
old_listing_card = '''function ListingCard({ listing }: { listing: any }) {
  const conditionLabel: Record<string, string> = {
    new: "全新", like_new: "近全新", good: "良好", fair: "一般"
  };'''

new_listing_card = '''function ListingCard({ listing }: { listing: any }) {
  const { t } = useTranslation();
  const conditionLabel: Record<string, string> = {
    new: t("marketplace.conditionNew"), like_new: t("marketplace.conditionLikeNew"), good: t("marketplace.conditionGood"), fair: t("marketplace.conditionFair")
  };'''

if old_listing_card in content:
    content = content.replace(old_listing_card, new_listing_card, 1)
    print("  ✓ Fixed ListingCard sub-component")
else:
    print("  ✗ ListingCard NOT FOUND")

# Fix AuctionCard sub-component references
replacements = [
    # Auction card
    ('"競標中"', 't("sellerPublicProfile.bidding")'),
    ('{isCurrentBid ? "當前出價" : "起拍價"}', '{isCurrentBid ? t("sellerPublicProfile.currentBid") : t("sellerPublicProfile.startingBid")}'),
    ('{auction.bidCount ?? 0} 次出價', '{t("sellerPublicProfile.nBids", { n: auction.bidCount ?? 0 })}'),
    
    # Error/empty states
    ('<p className="text-gray-400 text-sm mb-6">找不到此賣家的資料</p>', '<p className="text-gray-400 text-sm mb-6">{t("sellerPublicProfile.sellerNotFound")}</p>'),
    ('>返回商城</Button>', '>{t("sellerPublicProfile.backToMarket")}</Button>'),
    ('>返回商城</Link>', '>{t("sellerPublicProfile.backToMarket")}</Link>'),
    
    # Badges
    ('>優質賣家</span>', '>{t("sellerPublicProfile.premiumSeller")}</span>'),
    ('>活躍賣家</span>', '>{t("sellerPublicProfile.activeSeller")}</span>'),
    ('>拍賣中</span>', '>{t("sellerPublicProfile.auctioning")}</span>'),
    
    # Stats
    ('({seller.ratingCount} 評價)', '({t("sellerPublicProfile.nReviews", { n: seller.ratingCount })})'),
    ('`${seller.totalSales} 筆成交`', 't("sellerPublicProfile.nSales", { n: seller.totalSales })'),
    ('`加入於 ${new Date(seller.memberSince).toLocaleDateString("zh-HK", { year: "numeric", month: "long" })}`', 't("sellerPublicProfile.memberSince", { date: new Date(seller.memberSince).toLocaleDateString(undefined, { year: "numeric", month: "long" }) })'),
    
    # Stat pills
    ('{ label: "在售商品"', '{ label: t("sellerPublicProfile.forSale")'),
    ('{ label: "進行中拍賣"', '{ label: t("sellerPublicProfile.activeAuctions")'),
    ('{ label: "買家評價"', '{ label: t("sellerPublicProfile.buyerReviews")'),
    
    # Tab labels
    ('在售商品 ({listings.length})', '{t("sellerPublicProfile.forSale")} ({listings.length})'),
    ('進行中拍賣 ({auctionCount})', '{t("sellerPublicProfile.activeAuctions")} ({auctionCount})'),
    ('買家評價 ({reviewTotal})', '{t("sellerPublicProfile.buyerReviews")} ({reviewTotal})'),
    
    # Empty states in tabs
    ('<p className="text-gray-400 text-sm mt-1">此賣家暫無在售商品</p>', '<p className="text-gray-400 text-sm mt-1">{t("sellerPublicProfile.noListings")}</p>'),
    ('<p className="text-gray-500 font-medium">暫無進行中拍賣</p>', '<p className="text-gray-500 font-medium">{t("sellerPublicProfile.noAuctions")}</p>'),
    ('<p className="text-gray-400 text-sm mt-1">此賣家目前沒有競標中的商品</p>', '<p className="text-gray-400 text-sm mt-1">{t("sellerPublicProfile.noAuctionsDesc")}</p>'),
    ('<p className="text-gray-400 text-sm mt-1">此賣家暫無買家評價</p>', '<p className="text-gray-400 text-sm mt-1">{t("sellerPublicProfile.noReviews")}</p>'),
    
    # Reviews
    ('{r.buyerName ?? "匿名買家"}', '{r.buyerName ?? t("sellerPublicProfile.anonymousBuyer")}'),
    ('顯示最新 {reviews.length} 則，共 {reviewTotal} 則評價', '{t("sellerPublicProfile.showingReviews", { shown: reviews.length, total: reviewTotal })}'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Replaced: {old[:60]}")
    else:
        print(f"  ✗ NOT FOUND: {old[:60]}")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal replacements: {count}")
