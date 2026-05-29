import json

LOCALES = {
    "zh-TW": "/home/ubuntu/boxium-ptcg/client/src/locales/zh-TW.json",
    "en": "/home/ubuntu/boxium-ptcg/client/src/locales/en.json",
    "ja": "/home/ubuntu/boxium-ptcg/client/src/locales/ja.json",
}

# Keys to add to each locale
new_keys = {
    "zh-TW": {
        "camera": {
            "scanTitle": "掃描卡牌識別"
        },
        "footer": {
            "cardSearch": "卡牌搜尋",
            "pricing": "市場格價",
            "marketplace": "市集",
            "grading": "PSA 鑑定",
            "about": "平台介紹",
            "contact": "聯絡我們"
        },
        "orderStatus": {
            "pendingPayment": {
                "buyerLabel": "待付款",
                "sellerLabel": "待付款",
                "buyerDesc": "等待完成付款",
                "sellerDesc": "等待買家付款"
            },
            "paidHeld": {
                "buyerLabel": "已付款",
                "sellerLabel": "待出貨",
                "buyerDesc": "付款已確認",
                "sellerDesc": "請盡快安排出貨"
            },
            "shipped": {
                "buyerLabel": "運送中",
                "sellerLabel": "已出貨",
                "buyerDesc": "商品正在運送",
                "sellerDesc": "等待買家確認收貨"
            },
            "delivered": {
                "buyerLabel": "待確認",
                "sellerLabel": "已送達",
                "buyerDesc": "請確認收貨",
                "sellerDesc": "等待買家確認"
            },
            "completed": {
                "buyerLabel": "已完成",
                "sellerLabel": "已完成",
                "buyerDesc": "訂單已完成",
                "sellerDesc": "交易完成"
            }
        },
        "common": {
            "refreshing": "更新中…",
            "releaseToRefresh": "放開以更新",
            "pullToRefresh": "下拉更新"
        }
    },
    "en": {
        "camera": {
            "scanTitle": "Scan Card to Identify"
        },
        "footer": {
            "cardSearch": "Card Search",
            "pricing": "Market Price",
            "marketplace": "Marketplace",
            "grading": "PSA Grading",
            "about": "About Us",
            "contact": "Contact Us"
        },
        "orderStatus": {
            "pendingPayment": {
                "buyerLabel": "Pending Payment",
                "sellerLabel": "Pending Payment",
                "buyerDesc": "Waiting for payment",
                "sellerDesc": "Waiting for buyer payment"
            },
            "paidHeld": {
                "buyerLabel": "Paid",
                "sellerLabel": "Pending Shipment",
                "buyerDesc": "Payment confirmed",
                "sellerDesc": "Please arrange shipment soon"
            },
            "shipped": {
                "buyerLabel": "In Transit",
                "sellerLabel": "Shipped",
                "buyerDesc": "Item is being shipped",
                "sellerDesc": "Waiting for buyer to confirm receipt"
            },
            "delivered": {
                "buyerLabel": "Pending Confirmation",
                "sellerLabel": "Delivered",
                "buyerDesc": "Please confirm receipt",
                "sellerDesc": "Waiting for buyer confirmation"
            },
            "completed": {
                "buyerLabel": "Completed",
                "sellerLabel": "Completed",
                "buyerDesc": "Order completed",
                "sellerDesc": "Transaction completed"
            }
        },
        "common": {
            "refreshing": "Refreshing…",
            "releaseToRefresh": "Release to refresh",
            "pullToRefresh": "Pull to refresh"
        }
    },
    "ja": {
        "camera": {
            "scanTitle": "カードをスキャンして識別"
        },
        "footer": {
            "cardSearch": "カード検索",
            "pricing": "市場価格",
            "marketplace": "マーケット",
            "grading": "PSA グレーディング",
            "about": "プラットフォーム紹介",
            "contact": "お問い合わせ"
        },
        "orderStatus": {
            "pendingPayment": {
                "buyerLabel": "支払い待ち",
                "sellerLabel": "支払い待ち",
                "buyerDesc": "支払いを完了してください",
                "sellerDesc": "購入者の支払いを待っています"
            },
            "paidHeld": {
                "buyerLabel": "支払い済み",
                "sellerLabel": "発送待ち",
                "buyerDesc": "支払いが確認されました",
                "sellerDesc": "早急に発送手配をしてください"
            },
            "shipped": {
                "buyerLabel": "配送中",
                "sellerLabel": "発送済み",
                "buyerDesc": "商品を配送中です",
                "sellerDesc": "購入者の受取確認を待っています"
            },
            "delivered": {
                "buyerLabel": "確認待ち",
                "sellerLabel": "配達済み",
                "buyerDesc": "受取確認をしてください",
                "sellerDesc": "購入者の確認を待っています"
            },
            "completed": {
                "buyerLabel": "完了",
                "sellerLabel": "完了",
                "buyerDesc": "注文が完了しました",
                "sellerDesc": "取引が完了しました"
            }
        },
        "common": {
            "refreshing": "更新中…",
            "releaseToRefresh": "離して更新",
            "pullToRefresh": "引っ張って更新"
        }
    }
}

def deep_merge(base, updates):
    """Recursively merge updates into base dict."""
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

for locale, path in LOCALES.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    deep_merge(data, new_keys[locale])
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Updated {locale}")

print("\nDone!")
