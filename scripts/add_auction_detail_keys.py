#!/usr/bin/env python3
"""Add missing auctionDetail i18n keys to all locale files."""
import json
import os

BASE = "/home/ubuntu/boxium-ptcg/client/src/locales"

new_keys = {
    "zh-TW": {
        "auctionDetail": {
            "countdown": {
                "day": "天",
                "hour": "時",
                "min": "分",
                "sec": "秒",
                "ended": "已結標",
                "endingSoon": "即將結標！"
            },
            "review": {
                "anonymous": "匿名評價",
                "submit": "提交評價",
                "commentLabel": "評語（選填）",
                "commentPlaceholder": "分享您的交易體驗...",
                "stars": "{{count}} 星"
            },
            "bidPanel": {
                "bidSuccess": "出價成功！",
                "buyNowSuccess": "即買成功！請前往訂單頁面完成付款。",
                "minBidError": "最低出價為 HK${{amount}}",
                "currentHighest": "目前最高出價",
                "startingBid": "起標價",
                "bidCount": "共 {{count}} 次出價",
                "timeLeft": "距離結標",
                "youAreHighest": "您目前是最高出價者",
                "waitForOthers": "等待其他買家出價後方可繼續出價",
                "yourBid": "您的出價（最低 HK${{amount}}）",
                "placeBid": "出價",
                "placeBidNow": "立即出價",
                "buyNowPrice": "即買價",
                "buyNow": "立即購買"
            },
            "ban": {
                "title": "您的帳戶已被禁止參與拍賣",
                "reason": "原因",
                "noPayment": "未在期限內完成付款",
                "fakeBid": "虛假出價",
                "ruleViolation": "違反拍賣規則",
                "permanent": "永久封禁，請聯絡客服申訴",
                "unbanTime": "解封時間",
                "noPaymentCount": "累計未付款違約：{{count}} 次",
                "warning": "注意：您有 {{count}} 次違約警告記錄。累計 3 次未付款將被封禁 30 天。請確保得標後在 24 小時內完成付款。"
            },
            "bidHistory": {
                "title": "出價記錄",
                "count": "{{count}} 次",
                "noBids": "暫無出價記錄",
                "beTheFirst": "成為第一個出價者！",
                "highestBid": "最高出價",
                "anonymousBuyer": "買家 #{{id}}",
                "collapse": "收起",
                "viewAll": "查看全部 {{count}} 筆出價"
            },
            "main": {
                "loading": "載入拍賣資訊中...",
                "notFound": "找不到此拍賣",
                "backToMarket": "返回市集",
                "auctionId": "拍賣 #{{id}}"
            },
            "status": {
                "pendingReview": "審核中",
                "scheduled": "已排程",
                "active": "競標中",
                "endingSoon": "即將結標",
                "endedSold": "已售出",
                "endedNoBid": "流拍",
                "cancelled": "已取消",
                "rejected": "已拒絕",
                "ended": "拍賣已結束",
                "notStarted": "拍賣尚未開始",
                "scheduledStart": "開始"
            },
            "antiSnipe": {
                "title": "結標時間已延長",
                "message": "有人在結標前 {{minutes}} 分鐘內出價，結標時間已延長 {{extensions}} 次（每次 {{minutes}} 分鐘）。"
            },
            "reserve": {
                "met": "✓ 保留價已達到，得標者將確認成交",
                "notMet": "保留價尚未達到，目前出價不保證成交"
            },
            "description": {
                "title": "商品描述",
                "condition": "品相",
                "noDescription": "賣家暫未提供詳細描述"
            },
            "info": {
                "title": "拍賣資訊",
                "startingBid": "起標價",
                "minIncrement": "最低加價",
                "startTime": "開始時間",
                "endTime": "結標時間"
            },
            "seller": {
                "title": "賣家資訊",
                "totalSales": "累計成交",
                "totalSalesCount": "{{count}} 筆",
                "ratingCount": "{{count}} 評價"
            },
            "gallery": {
                "productImage": "商品圖片"
            },
            "header": {
                "details": "拍賣詳情"
            },
            "terms": {
                "dialog": {
                    "cancel": "取消"
                },
                "buyer": {
                    "buyerProtection": {
                        "title": "買家保障",
                        "desc": "得標後 24 小時內付款，商品與描述不符可申請退款保障。"
                    }
                }
            }
        }
    },
    "en": {
        "auctionDetail": {
            "countdown": {
                "day": "D",
                "hour": "H",
                "min": "M",
                "sec": "S",
                "ended": "Ended",
                "endingSoon": "Ending Soon!"
            },
            "review": {
                "anonymous": "Anonymous review",
                "submit": "Submit Review",
                "commentLabel": "Comment (optional)",
                "commentPlaceholder": "Share your trading experience...",
                "stars": "{{count}} stars"
            },
            "bidPanel": {
                "bidSuccess": "Bid placed successfully!",
                "buyNowSuccess": "Purchase successful! Please go to Orders to complete payment.",
                "minBidError": "Minimum bid is HK${{amount}}",
                "currentHighest": "Current Highest Bid",
                "startingBid": "Starting Bid",
                "bidCount": "{{count}} bids",
                "timeLeft": "Time Left",
                "youAreHighest": "You are the highest bidder",
                "waitForOthers": "Wait for other buyers to bid before bidding again",
                "yourBid": "Your bid (min HK${{amount}})",
                "placeBid": "Place Bid",
                "placeBidNow": "Bid Now",
                "buyNowPrice": "Buy Now Price",
                "buyNow": "Buy Now"
            },
            "ban": {
                "title": "Your account is banned from auctions",
                "reason": "Reason",
                "noPayment": "Failed to complete payment within deadline",
                "fakeBid": "Fake bidding",
                "ruleViolation": "Auction rule violation",
                "permanent": "Permanent ban. Please contact support to appeal.",
                "unbanTime": "Unban time",
                "noPaymentCount": "Non-payment violations: {{count}}",
                "warning": "Warning: You have {{count}} violation warning(s). 3 non-payments will result in a 30-day ban. Please complete payment within 24 hours after winning."
            },
            "bidHistory": {
                "title": "Bid History",
                "count": "{{count}} bids",
                "noBids": "No bids yet",
                "beTheFirst": "Be the first to bid!",
                "highestBid": "Highest",
                "anonymousBuyer": "Buyer #{{id}}",
                "collapse": "Collapse",
                "viewAll": "View all {{count}} bids"
            },
            "main": {
                "loading": "Loading auction...",
                "notFound": "Auction not found",
                "backToMarket": "Back to Market",
                "auctionId": "Auction #{{id}}"
            },
            "status": {
                "pendingReview": "Pending Review",
                "scheduled": "Scheduled",
                "active": "Live",
                "endingSoon": "Ending Soon",
                "endedSold": "Sold",
                "endedNoBid": "No Bids",
                "cancelled": "Cancelled",
                "rejected": "Rejected",
                "ended": "Auction Ended",
                "notStarted": "Auction Not Started",
                "scheduledStart": " starts"
            },
            "antiSnipe": {
                "title": "Auction Extended",
                "message": "Someone bid within {{minutes}} minutes of closing. End time extended {{extensions}} time(s) ({{minutes}} min each)."
            },
            "reserve": {
                "met": "✓ Reserve price met - winner confirmed",
                "notMet": "Reserve price not met - current bid not guaranteed"
            },
            "description": {
                "title": "Item Description",
                "condition": "Condition",
                "noDescription": "No description provided by seller"
            },
            "info": {
                "title": "Auction Info",
                "startingBid": "Starting Bid",
                "minIncrement": "Min Increment",
                "startTime": "Start Time",
                "endTime": "End Time"
            },
            "seller": {
                "title": "Seller Info",
                "totalSales": "Total Sales",
                "totalSalesCount": "{{count}}",
                "ratingCount": "{{count}} reviews"
            },
            "gallery": {
                "productImage": "Product Image"
            },
            "header": {
                "details": "Auction Details"
            },
            "terms": {
                "dialog": {
                    "cancel": "Cancel"
                },
                "buyer": {
                    "buyerProtection": {
                        "title": "Buyer Protection",
                        "desc": "Pay within 24 hours of winning. Refund available if item doesn't match description."
                    }
                }
            }
        }
    },
    "ja": {
        "auctionDetail": {
            "countdown": {
                "day": "日",
                "hour": "時",
                "min": "分",
                "sec": "秒",
                "ended": "終了",
                "endingSoon": "まもなく終了！"
            },
            "review": {
                "anonymous": "匿名レビュー",
                "submit": "レビューを送信",
                "commentLabel": "コメント（任意）",
                "commentPlaceholder": "取引体験をシェアしてください...",
                "stars": "{{count}} 星"
            },
            "bidPanel": {
                "bidSuccess": "入札しました！",
                "buyNowSuccess": "購入完了！注文ページで支払いを完了してください。",
                "minBidError": "最低入札額はHK${{amount}}です",
                "currentHighest": "現在の最高入札額",
                "startingBid": "開始価格",
                "bidCount": "{{count}}回の入札",
                "timeLeft": "残り時間",
                "youAreHighest": "あなたが最高入札者です",
                "waitForOthers": "他の入札者が入札するまでお待ちください",
                "yourBid": "入札額（最低HK${{amount}}）",
                "placeBid": "入札する",
                "placeBidNow": "今すぐ入札",
                "buyNowPrice": "即決価格",
                "buyNow": "今すぐ購入"
            },
            "ban": {
                "title": "アカウントがオークションから禁止されています",
                "reason": "理由",
                "noPayment": "期限内に支払いを完了しなかった",
                "fakeBid": "虚偽入札",
                "ruleViolation": "オークション規則違反",
                "permanent": "永久禁止。サポートに連絡してください。",
                "unbanTime": "禁止解除時間",
                "noPaymentCount": "未払い違反：{{count}}回",
                "warning": "警告：{{count}}回の違反警告があります。3回の未払いで30日間禁止されます。落札後24時間以内に支払いを完了してください。"
            },
            "bidHistory": {
                "title": "入札履歴",
                "count": "{{count}}回",
                "noBids": "まだ入札がありません",
                "beTheFirst": "最初の入札者になりましょう！",
                "highestBid": "最高入札",
                "anonymousBuyer": "購入者 #{{id}}",
                "collapse": "折りたたむ",
                "viewAll": "全{{count}}件の入札を見る"
            },
            "main": {
                "loading": "オークション情報を読み込み中...",
                "notFound": "オークションが見つかりません",
                "backToMarket": "マーケットに戻る",
                "auctionId": "オークション #{{id}}"
            },
            "status": {
                "pendingReview": "審査中",
                "scheduled": "予定済み",
                "active": "入札中",
                "endingSoon": "まもなく終了",
                "endedSold": "落札済み",
                "endedNoBid": "流札",
                "cancelled": "キャンセル",
                "rejected": "却下",
                "ended": "オークション終了",
                "notStarted": "オークション未開始",
                "scheduledStart": "開始"
            },
            "antiSnipe": {
                "title": "終了時間が延長されました",
                "message": "終了{{minutes}}分前に入札がありました。終了時間が{{extensions}}回延長されました（各{{minutes}}分）。"
            },
            "reserve": {
                "met": "✓ 最低落札価格に達しました",
                "notMet": "最低落札価格に未達 - 現在の入札は保証されません"
            },
            "description": {
                "title": "商品説明",
                "condition": "コンディション",
                "noDescription": "出品者が説明を提供していません"
            },
            "info": {
                "title": "オークション情報",
                "startingBid": "開始価格",
                "minIncrement": "最低入札単位",
                "startTime": "開始時間",
                "endTime": "終了時間"
            },
            "seller": {
                "title": "出品者情報",
                "totalSales": "累計取引",
                "totalSalesCount": "{{count}}件",
                "ratingCount": "{{count}}件のレビュー"
            },
            "gallery": {
                "productImage": "商品画像"
            },
            "header": {
                "details": "オークション詳細"
            },
            "terms": {
                "dialog": {
                    "cancel": "キャンセル"
                },
                "buyer": {
                    "buyerProtection": {
                        "title": "購入者保護",
                        "desc": "落札後24時間以内に支払い。商品説明と異なる場合は返金申請可能。"
                    }
                }
            }
        }
    }
}

def deep_merge(base, updates):
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

for lang, keys in new_keys.items():
    filepath = os.path.join(BASE, f"{lang}.json")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    deep_merge(data, keys)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {filepath}")

print("Done!")
