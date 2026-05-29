#!/usr/bin/env python3
"""Batch fix remaining hardcoded Chinese strings in non-admin pages."""
import re, json, os

def fix_file(path, replacements):
    """Apply multiple replacements to a file."""
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print(f"Fixed: {path}")

# ── SearchResults.tsx ────────────────────────────────────────────────────────
fix_file('/home/ubuntu/boxium-ptcg/client/src/pages/SearchResults.tsx', [
    (
        "document.title = `搜尋「${query}」的 TCG 卡牌價格 - BOXIUM 市場格價平台`;",
        "document.title = t(\"searchResults.seo.titleWithQuery\", { query });"
    ),
    (
        "metaDesc.setAttribute('content', `在 BOXIUM 搜尋「${query}」相關的 TCG 卡牌，查看 PSA 10 價格、SNKRDUNK 交易記錄和市場趨勢分析。`);",
        "metaDesc.setAttribute('content', t(\"searchResults.seo.descWithQuery\", { query }));"
    ),
    (
        "metaKeywords.setAttribute('content', `${query},TCG 卡牌,集換式卡牌,PSA 10,卡牌價格,SNKRDUNK,市場格價`);",
        "metaKeywords.setAttribute('content', t(\"searchResults.seo.keywordsWithQuery\", { query }));"
    ),
    (
        "document.title = '搜尋 TCG 卡牌價格 - BOXIUM 市場格價平台';",
        "document.title = t(\"searchResults.seo.title\");"
    ),
    (
        "{query ? `搜尋「${query}」的 TCG 卡牌價格` : '搜尋 TCG 卡牌價格'}",
        "{query ? t(\"searchResults.header.titleWithQuery\", { query }) : t(\"searchResults.header.title\")}"
    ),
    (
        "找到 {searchResults.length} 張卡牌",
        "{t(\"searchResults.header.found\", { count: searchResults.length })}"
    ),
    (
        "<span>第 {currentPage} 頁 / 共 {totalPages} 頁（總共 {totalResults} 張卡牌）</span>",
        "<span>{t(\"searchResults.pagination.pageInfo\", { page: currentPage, total: totalPages, count: totalResults })}</span>"
    ),
    (
        "<span>顯示 {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, totalResults)} 張</span>",
        "<span>{t(\"searchResults.pagination.showing\", { from: (currentPage - 1) * limit + 1, to: Math.min(currentPage * limit, totalResults) })}</span>"
    ),
    (
        "alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 卡牌圖像`}",
        "alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} ${t(\"searchResults.card.imageAlt\")}`}"
    ),
    (
        "                      卡盒\n                    </span>",
        "                      {t(\"searchResults.card.sealedProduct\")}\n                    </span>"
    ),
    (
        "                上一頁\n              </Button>",
        "                {t(\"common.prevPage\")}\n              </Button>"
    ),
    (
        "                下一頁\n              </Button>",
        "                {t(\"common.nextPage\")}\n              </Button>"
    ),
    (
        '{query ? `找不到「${query}」相符的卡牌` : "請輸入搜尋關鍵字"}',
        '{query ? t("searchResults.noResults.withQuery", { query }) : t("searchResults.noResults.empty")}'
    ),
    (
        '<span className="text-sm text-muted-foreground">正在尋找相似搜尋</span>',
        '<span className="text-sm text-muted-foreground">{t("searchResults.suggestions.finding")}</span>'
    ),
    (
        '<span className="text-sm font-medium text-foreground">您是否想搜尋：</span>',
        '<span className="text-sm font-medium text-foreground">{t("searchResults.suggestions.didYouMean")}</span>'
    ),
])

# ── Profile.tsx ──────────────────────────────────────────────────────────────
# Check what's left in Profile.tsx
with open('/home/ubuntu/boxium-ptcg/client/src/pages/Profile.tsx') as f:
    profile_content = f.read()

chinese_pattern = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]')
profile_lines = profile_content.split('\n')
hits = []
for i, l in enumerate(profile_lines, 1):
    stripped = l.strip()
    if (chinese_pattern.search(l) and not stripped.startswith('//') and 't("' not in l and "t('" not in l and '/*' not in l and '*' not in stripped[:2]):
        hits.append((i, l[:100]))
print(f"\nProfile.tsx remaining: {len(hits)} hits")
for lineno, line in hits[:10]:
    print(f"  {lineno:4d}: {line}")

print("\nDone!")
