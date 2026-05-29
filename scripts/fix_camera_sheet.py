import re

filepath = "/home/ubuntu/boxium-ptcg/client/src/components/CameraSearchSheet.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add useTranslation import if not present
if 'useTranslation' not in content:
    content = content.replace(
        'import { toast } from "sonner";',
        'import { toast } from "sonner";\nimport { useTranslation } from "react-i18next";'
    )

# Add const { t } = useTranslation(); after useLocation
if 'const { t } = useTranslation();' not in content:
    content = content.replace(
        'export function CameraSearchSheet({ open, onOpenChange, onCardSelect, cardLinkPrefix = "card" }: CameraSearchSheetProps) {\n  const [, setLocation] = useLocation();',
        'export function CameraSearchSheet({ open, onOpenChange, onCardSelect, cardLinkPrefix = "card" }: CameraSearchSheetProps) {\n  const [, setLocation] = useLocation();\n  const { t } = useTranslation();'
    )

# Replacements
replacements = [
    ('toast.success(`已識別：${best.nameJa || best.name}`)', 
     't("camera.identified", { name: best.nameJa || best.name })'.join(['toast.success(', ')'])),
    ('toast.error("識別失敗，請重試")', 'toast.error(t("camera.identifyFailed"))'),
    ('toast.error("無法啟動相機，請使用上傳功能")', 'toast.error(t("camera.cameraStartFailed"))'),
    ('toast.error("無法擷取畫面")', 'toast.error(t("camera.captureFailed"))'),
    ('case "camera": return onCardSelect ? "拍照選卡" : "拍照識別";', 
     'case "camera": return onCardSelect ? t("camera.title.selectCard") : t("camera.title.identify");'),
    ('case "analyzing": return "AI 分析中...";', 'case "analyzing": return t("camera.title.analyzing");'),
    ('case "results": return "識別結果";', 'case "results": return t("camera.title.results");'),
    ('case "no_match": return "識別完成";', 'case "no_match": return t("camera.title.noMatch");'),
    ('case "permission_denied": return "相機權限";', 'case "permission_denied": return t("camera.title.permission");'),
    ('自動識別</span>', '{t("camera.autoScan")}</span>'),
    ('將卡牌對準框內，系統將自動識別', '{t("camera.guideText")}'),
    ('識別成功！</p>', '{t("camera.identifySuccess")}</p>'),
    ('啟動相機中...</p>', '{t("camera.starting")}</p>'),
    ('>相簿</span>', '>{t("camera.album")}</span>'),
    ('>翻轉</span>', '>{t("camera.flip")}</span>'),
    ('💡 拍攝技巧</p>', '💡 {t("camera.tip.title")}</p>'),
    ('>確保卡牌名稱及卡號清晰可見，避免反光及陰影。卡牌充滿取景框時系統將自動識別。</p>', '>{t("camera.tip.desc")}</p>'),
    ('>低光模式</p>', '>{t("camera.lowLight.title")}</p>'),
    ('>降低亮度偵測門值至 15，適用於光線不足環境</p>', '>{t("camera.lowLight.desc")}</p>'),
    ('>相機權限被拒絕</p>', '>{t("camera.permission.denied")}</p>'),
    ('>請在瀏覽器設定中允許相機存取，或使用上傳圖片功能</p>', '>{t("camera.permission.desc")}</p>'),
    ('/>改用上傳圖片', '/>{t("camera.permission.useUpload")}'),
    ('>AI 識別中</span>', '>{t("camera.analyzing")}</span>'),
    ('"正在讀取卡牌資訊..."', 't("camera.progress.reading")'),
    ('"比對卡牌資料庫..."', 't("camera.progress.matching")'),
    ('"精準匹配中..."', 't("camera.progress.precise")'),
    ('"即將完成..."', 't("camera.progress.finishing")'),
    ('/>由 Gemini AI 驅動', '/>{t("camera.poweredBy")}'),
    ('>AI 識別結果</p>', '>{t("camera.results.aiResult")}</p>'),
    ('找到 {matchResults.length} 個匹配結果，{onCardSelect ? "請選擇要加入的卡牌" : "請選擇正確的卡牌"}',
     '{t("camera.results.found", { count: matchResults.length, action: onCardSelect ? t("camera.results.selectToAdd") : t("camera.results.selectCorrect") })}'),
    ('>最佳</span>', '>{t("camera.results.best")}</span>'),
    ('{card.matchScore}分\n                    </span>', '{t("camera.results.score", { score: card.matchScore })}\n                    </span>'),
    ('/>重新拍攝\n            </button>\n          </div>\n        )}\n\n        {/* ── STAGE: NO MATCH ── */}',
     '/>{t("camera.retake")}\n            </button>\n          </div>\n        )}\n\n        {/* ── STAGE: NO MATCH ── */}'),
    ('>AI 識別到的卡牌</p>', '>{t("camera.noMatch.aiIdentified")}</p>'),
    ('>資料庫中未找到完全匹配的卡牌</p>', '>{t("camera.noMatch.notInDb")}</p>'),
    ('>無法識別卡牌</p>', '>{t("camera.noMatch.cannotIdentify")}</p>'),
    ('>請確保圖片清晰且包含完整卡牌</p>', '>{t("camera.noMatch.ensureClear")}</p>'),
    ('搜尋「{identificationInfo.cardNameJa || identificationInfo.cardName}」',
     '{t("camera.noMatch.search", { name: identificationInfo.cardNameJa || identificationInfo.cardName })}'),
    ('/>重新拍攝\n              </button>\n            </div>\n          </div>\n        )}',
     '/>{t("camera.retake")}\n              </button>\n            </div>\n          </div>\n        )}'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"✓ Replaced: {old[:60]}...")
    else:
        print(f"✗ Not found: {old[:60]}...")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
