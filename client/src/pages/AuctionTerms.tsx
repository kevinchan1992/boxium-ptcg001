import { Link } from "wouter";
import { ArrowLeft, Gavel, Clock, CreditCard, AlertTriangle, Shield, ChevronRight } from "lucide-react";

const sections = [
  {
    id: "overview",
    icon: Gavel,
    title: "競標規則總覽",
    content: [
      {
        heading: "1.1 競標資格",
        body: "所有已完成身份驗證的 BOXIUM 會員均可參與拍賣競標。賣家須通過 BOXIUM 賣家認證，並遵守平台商品上架規範。",
      },
      {
        heading: "1.2 出價規則",
        body: "每次出價必須高於當前最高出價加上最低加價幅度（由賣家設定）。出價一經提交即具法律約束力，不得撤回。若拍賣設有保留價，成交價必須達到保留價方可成交。",
      },
      {
        heading: "1.3 即時購買（Buy Now）",
        body: "若賣家設定了即時購買價格，買家可在拍賣結束前隨時以該價格直接購買，拍賣將立即結束。",
      },
      {
        heading: "1.4 防狙擊機制",
        body: "為防止最後一刻惡意搶標，若在拍賣結束前 5 分鐘內有新出價，拍賣時間將自動延長 5 分鐘。此機制可重複觸發，確保所有競標者有公平機會回應。",
      },
    ],
  },
  {
    id: "payment",
    icon: CreditCard,
    title: "付款條款",
    content: [
      {
        heading: "2.1 付款期限",
        body: "得標者必須在拍賣結束後 24 小時內完成付款。系統將在結標後立即發送付款通知，並在 12 小時後發送提醒通知。",
      },
      {
        heading: "2.2 付款方式",
        body: "BOXIUM 平台接受信用卡、Stripe 支付等主要付款方式。所有交易均通過 Stripe 安全處理，BOXIUM 不儲存任何信用卡資料。",
      },
      {
        heading: "2.3 逾期未付款",
        body: "若得標者未在 24 小時內完成付款，訂單將自動取消，並記錄一次棄標違規。賣家有權重新上架商品或直接聯繫第二高出價者。",
      },
      {
        heading: "2.4 退款政策",
        body: "商品一旦發貨，原則上不接受退款。若商品與描述嚴重不符，買家可在收貨後 48 小時內提出爭議申請，BOXIUM 客服將介入調查。",
      },
    ],
  },
  {
    id: "violations",
    icon: AlertTriangle,
    title: "棄標懲罰制度",
    content: [
      {
        heading: "3.1 棄標定義",
        body: "以下情況均視為棄標違規：得標後 24 小時內未完成付款、惡意出價後主動要求取消、以任何方式規避付款義務。",
      },
      {
        heading: "3.2 懲罰級別",
        body: "BOXIUM 採用累進式懲罰制度：\n• 第 1 次違規：書面警告，記錄在案\n• 第 2 次違規：封禁競標資格 7 天\n• 第 3 次違規：封禁競標資格 30 天\n• 第 4 次及以上：永久封禁競標資格",
      },
      {
        heading: "3.3 申訴機制",
        body: "若認為違規記錄有誤，可在 7 天內向 BOXIUM 客服提出申訴。申訴期間違規記錄暫不生效。BOXIUM 將在 3 個工作日內回覆申訴結果。",
      },
      {
        heading: "3.4 管理員裁量權",
        body: "BOXIUM 管理員有權根據具體情況調整懲罰力度，包括提前解除封禁或加重懲罰。所有決定均以維護平台公平交易環境為原則。",
      },
    ],
  },
  {
    id: "seller",
    icon: Shield,
    title: "賣家責任",
    content: [
      {
        heading: "4.1 商品真實性",
        body: "賣家保證所有上架商品為真品，商品描述、評級及圖片均如實呈現。虛假描述或偽造評級將導致帳號永久封禁並承擔法律責任。",
      },
      {
        heading: "4.2 拍賣取消",
        body: "拍賣開始後，賣家不得無故取消拍賣。若確有特殊原因需要取消，須聯繫 BOXIUM 客服審批。惡意取消拍賣將受到相應懲罰。",
      },
      {
        heading: "4.3 發貨義務",
        body: "賣家須在買家付款後 3 個工作日內完成發貨，並提供有效追蹤號碼。延遲發貨或拒絕發貨將導致訂單取消並退款給買家。",
      },
      {
        heading: "4.4 保留價設定",
        body: "賣家可設定保留價（最低成交價），但保留價不得高於起標價的 5 倍。保留價對買家不公開，僅顯示「保留價已達到/未達到」狀態。",
      },
    ],
  },
  {
    id: "timing",
    icon: Clock,
    title: "時間規則",
    content: [
      {
        heading: "5.1 拍賣時長",
        body: "賣家可設定 1 天至 7 天的拍賣時長。拍賣開始時間由賣家設定，系統將在設定時間自動開始競標。",
      },
      {
        heading: "5.2 結標時間",
        body: "拍賣在設定的結束時間自動結標。若觸發防狙擊機制，結標時間將相應延後。系統每 30 秒自動檢查並處理到期拍賣。",
      },
      {
        heading: "5.3 通知時間",
        body: "系統將在以下時間點發送通知：拍賣開始時（通知所有關注者）、結束前 1 小時（通知所有出價者）、結標後立即（通知得標者及賣家）、付款後 12 小時（提醒未付款的得標者）。",
      },
    ],
  },
];

export default function AuctionTerms() {
  return (
    <div className="min-h-screen bg-[#06038D]">
      {/* Header */}
      <div className="bg-[#04026A] border-b border-[#FEDD00]/20">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/marketplace">
            <button className="flex items-center gap-2 text-[#FEDD00]/70 hover:text-[#FEDD00] transition-colors text-sm mb-4">
              <ArrowLeft className="w-4 h-4" />
              返回市集
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FEDD00] rounded-lg flex items-center justify-center flex-shrink-0">
              <Gavel className="w-5 h-5 text-[#06038D]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">BOXIUM 拍賣條款</h1>
              <p className="text-[#FEDD00]/70 text-sm mt-0.5">Auction Terms & Conditions</p>
            </div>
          </div>
          <p className="text-white/60 text-sm mt-4 leading-relaxed">
            參與 BOXIUM 拍賣即表示您同意以下所有條款。請在出價前仔細閱讀，確保您了解所有規則和責任。
            最後更新：2026 年 3 月 31 日
          </p>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="bg-[#04026A]/50 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-[#FEDD00]/20 text-white/70 hover:text-[#FEDD00] text-xs font-medium transition-colors"
              >
                <s.icon className="w-3 h-3" />
                {s.title}
                <ChevronRight className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {sections.map((section) => (
          <div
            key={section.id}
            id={section.id}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden scroll-mt-20"
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border-b border-white/10">
              <div className="w-8 h-8 bg-[#FEDD00]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <section.icon className="w-4 h-4 text-[#FEDD00]" />
              </div>
              <h2 className="text-lg font-bold text-white">{section.title}</h2>
            </div>

            {/* Section Content */}
            <div className="divide-y divide-white/5">
              {section.content.map((item, idx) => (
                <div key={idx} className="px-6 py-5">
                  <h3 className="text-[#FEDD00] font-semibold text-sm mb-2">{item.heading}</h3>
                  <p className="text-white/75 text-sm leading-relaxed whitespace-pre-line">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Penalty Summary Table */}
        <div className="bg-white/5 border border-[#FEDD00]/30 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 bg-[#FEDD00]/10 border-b border-[#FEDD00]/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#FEDD00]" />
              <h2 className="text-lg font-bold text-white">棄標懲罰速查表</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold">違規次數</th>
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold">懲罰措施</th>
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold">封禁時長</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { count: "第 1 次", action: "書面警告", duration: "無封禁", color: "text-green-400" },
                  { count: "第 2 次", action: "封禁競標資格", duration: "7 天", color: "text-yellow-400" },
                  { count: "第 3 次", action: "封禁競標資格", duration: "30 天", color: "text-orange-400" },
                  { count: "第 4 次及以上", action: "永久封禁競標資格", duration: "永久", color: "text-red-400" },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{row.count}</td>
                    <td className="px-6 py-4 text-white/75">{row.action}</td>
                    <td className={`px-6 py-4 font-semibold ${row.color}`}>{row.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-5">
          <p className="text-white/50 text-xs leading-relaxed text-center">
            BOXIUM 保留隨時修改本條款的權利。條款更新後將通過站內通知告知用戶。繼續使用 BOXIUM 拍賣服務即視為接受最新條款。
            如有疑問，請聯繫 BOXIUM 客服。
          </p>
        </div>
      </div>
    </div>
  );
}
