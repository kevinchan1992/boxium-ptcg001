# BOXIUM PTCG — Agent Instructions

## Project Overview
BOXIUM PTCG is a multilingual TCG card trading and grading platform.
Supported languages: Traditional Chinese (zh-TW), English (en), Japanese (ja)

---

## ⚠️ MANDATORY i18n RULES (CRITICAL — MUST FOLLOW)

### Rule 1: ALL non-admin pages MUST use i18n
- **Every** new page or UI component (except `/admin/*` routes and `AdminGrading.tsx` and other files in `client/src/components/Admin*.tsx`) **MUST** use `useTranslation()` from `react-i18next`
- **NEVER** hardcode Chinese, English, or Japanese text in JSX for non-admin pages
- Admin pages (`/admin/*`) are the **ONLY** exception — they do not require i18n

### Rule 2: Translation key structure
- Add new keys to **all three** locale files simultaneously:
  - `client/src/locales/zh-TW.json` (Traditional Chinese — source of truth)
  - `client/src/locales/en.json` (English)
  - `client/src/locales/ja.json` (Japanese)
- Use camelCase nested structure: `sectionName.subSection.keyName`
- Example: `grading.hero.title`, `marketplace.filter.allSeries`

### Rule 3: Adding new pages
When creating a new page `client/src/pages/NewPage.tsx`:
1. Add `import { useTranslation } from 'react-i18next';` at the top
2. Add `const { t } = useTranslation();` inside the component
3. Replace ALL hardcoded strings with `t('sectionName.keyName')`
4. Add the key to ALL THREE locale files before committing

### Rule 4: Adding new UI components
When adding new UI text to existing components:
1. Check if a suitable key already exists in the locale files
2. If not, add the new key to all three locale files
3. Use `t('existingSection.newKey')` in the component

### Rule 5: Translation quality
- Japanese translations must be **actual Japanese** (not Chinese characters)
- Use natural, friendly Japanese for a gaming/collecting audience
- Platform-specific terms:
  - 鑑定 → グレーディング (grading service context) or 鑑定 (PSA grading result context)
  - 市集/市場 → マーケット
  - 賣家 → 出品者
  - 買家 → 購入者
  - 收藏 → コレクション
  - 卡牌 → カード
  - 申請 → 申請
  - 出品 → 出品

### Rule 6: Verification
Before saving a checkpoint, run:
```bash
node -e "
const zh = JSON.parse(require('fs').readFileSync('client/src/locales/zh-TW.json','utf8'));
const ja = JSON.parse(require('fs').readFileSync('client/src/locales/ja.json','utf8'));
const en = JSON.parse(require('fs').readFileSync('client/src/locales/en.json','utf8'));
// Check for Chinese in ja.json
function check(obj, prefix='') {
  for (const [k,v] of Object.entries(obj)) {
    const key = prefix ? prefix+'.'+k : k;
    if (typeof v === 'string' && /[\u4e00-\u9fff]/.test(v) && !key.startsWith('admin.')) {
      console.log('UNTRANSLATED ja key:', key);
    } else if (typeof v === 'object') check(v, key);
  }
}
check(ja);
"
```

---

## Tech Stack
- React 19 + TypeScript + Vite
- Tailwind CSS 4 + shadcn/ui
- tRPC 11 + Express 4
- Drizzle ORM + MySQL (TiDB)
- react-i18next for internationalization
- recharts v3 for charts (React 19 compatible)
- Stripe for payments

## Key Files
- `client/src/locales/zh-TW.json` — Traditional Chinese (source of truth)
- `client/src/locales/en.json` — English translations
- `client/src/locales/ja.json` — Japanese translations
- `client/src/i18n.ts` — i18n configuration
- `client/src/App.tsx` — Routes and layout
- `drizzle/schema.ts` — Database schema
- `server/routers.ts` — tRPC procedures

## Stripe Integration
- Test card: 4242 4242 4242 4242
- Webhook endpoint: /api/stripe/webhook
- Both test and live keys configured

## Deployment
- Production: https://boxium.asia
- Manus hosted: https://boxiumptcg-mua4eq38.manus.space
