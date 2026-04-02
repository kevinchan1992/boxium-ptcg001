import { Link } from "wouter";
import { ArrowLeft, Gavel, Clock, CreditCard, AlertTriangle, Shield, FileText, Scale, ChevronRight, Info } from "lucide-react";

const sections = [
  {
    id: "overview",
    icon: Gavel,
    title: "競標規則",
    content: [
      {
        heading: "1.1 服務性質與適用範圍",
        body: "BOXIUM 拍賣服務（下稱「本服務」）由 BOXIUM 平台（下稱「本平台」）提供，作為買賣雙方進行交易的中介媒介。本平台僅提供技術及撮合服務，不對商品真實性、品質或交易結果作出任何明示或默示的保證。使用本服務即表示您已閱讀、理解並同意受本條款約束。",
      },
      {
        heading: "1.2 參與資格",
        body: "所有已完成帳號驗證的 BOXIUM 會員均可參與競標。賣家須通過 BOXIUM 賣家認證，並遵守平台商品上架規範。本平台保留在不作任何解釋的情況下，拒絕或終止任何用戶使用本服務的權利。",
      },
      {
        heading: "1.3 出價規則",
        body: "每次出價必須高於當前最高出價加上最低加價幅度（由賣家設定）。出價一經提交即具法律約束力，不得撤回。若拍賣設有保留價，成交價必須達到保留價方可成交。本平台對因技術故障、網絡中斷或其他不可抗力因素導致的出價失敗概不負責。",
      },
      {
        heading: "1.4 即時購買（Buy Now）",
        body: "若賣家設定了即時購買價格，買家可在拍賣結束前隨時以該價格直接購買，拍賣將立即結束。即時購買與競標出價同樣具有法律約束力，完成後不得取消。",
      },
      {
        heading: "1.5 防狙擊機制",
        body: "為確保公平競標環境，若在拍賣結束前 5 分鐘內有新出價，拍賣時間將自動延長 5 分鐘。此機制可重複觸發，直至無新出價為止。本平台對因此機制導致的拍賣延長不承擔任何責任。",
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
        body: "得標者必須在拍賣結束後 24 小時內完成付款。系統將在結標後立即發送付款通知。逾期未付款將視為棄標，並依本條款第三節執行相應措施。",
      },
      {
        heading: "2.2 付款方式",
        body: "本平台接受信用卡及 Stripe 支付等主要付款方式。所有交易均通過 Stripe 安全處理，本平台不儲存任何信用卡資料。付款手續費由買家承擔，具體費率以結算頁面顯示為準。",
      },
      {
        heading: "2.3 平台服務費",
        body: "本平台就每筆成交交易向賣家收取服務費，費率以平台公告為準。服務費將在款項結算時自動扣除。本平台保留調整服務費率的權利，並提前通知賣家。",
      },
      {
        heading: "2.4 款項結算",
        body: "買家付款確認後，款項將暫存於本平台。當買家確認收貨或商品出貨後 14 天自動完成時，系統將進入 48 小時冷靜期。冷靜期內如無爭議發生，款項將自動轉帳至賣家的 Stripe Connect 帳戶（扣除平台服務費後）。本平台對銀行轉帳延誤概不負責。",
      },
      {
        heading: "2.5 退款政策與爭議處理",
        body: "商品一旦發貨，原則上不接受退款申請。若商品與賣家描述存在重大差異，買家可在確認收貨後 48 小時冷靜期內透過本平台提出爭議申請。爭議期間款項將凍結，不會放款給賣家。本平台將根據雙方提供的資料作出裁決，裁決結果對雙方具有約束力。本平台的裁決屬最終決定，本平台不對任何裁決結果承擔法律責任。",
      },
    ],
  },
  {
    id: "violations",
    icon: AlertTriangle,
    title: "違規處理制度",
    content: [
      {
        heading: "3.1 棄標定義",
        body: "以下情況均視為棄標違規：得標後 24 小時內未完成付款；惡意出價後主動要求取消；以任何方式規避付款義務；提供虛假付款資料。本平台對棄標違規的認定擁有最終裁量權。",
      },
      {
        heading: "3.2 懲罰級別",
        body: "本平台採用累進式懲罰制度：\n• 第 1 次違規：書面警告，永久記錄在案\n• 第 2 次違規：封禁競標資格 7 天\n• 第 3 次違規：封禁競標資格 30 天\n• 第 4 次及以上：永久封禁競標資格，本平台保留追討損失的權利",
      },
      {
        heading: "3.3 賣家違規",
        body: "賣家若出現以下行為，本平台有權採取相應措施，包括但不限於暫停或終止賣家資格、扣押待結算款項：惡意取消已成交拍賣；提供虛假商品資訊；延遲或拒絕發貨；操控出價或與他人串謀。",
      },
      {
        heading: "3.4 申訴機制",
        body: "若認為違規記錄有誤，可在 7 個工作日內向本平台客服提出書面申訴，並提供相關佐證資料。申訴期間違規記錄暫不生效。本平台將在 5 個工作日內回覆申訴結果，申訴結果為最終決定。",
      },
      {
        heading: "3.5 平台裁量權",
        body: "本平台管理員有權根據具體情況，在不事先通知的情況下調整懲罰力度，包括提前解除封禁或加重懲罰。所有決定均以維護平台公平交易環境及保障各方合法權益為原則。本平台對行使此裁量權所產生的後果不承擔任何責任。",
      },
    ],
  },
  {
    id: "seller",
    icon: Shield,
    title: "賣家責任與義務",
    content: [
      {
        heading: "4.1 商品真實性保證",
        body: "賣家保證所有上架商品為真品，商品描述、評級及圖片均如實呈現，不存在任何誤導性陳述。若商品涉及第三方評級（如 PSA、BGS 等），賣家須確保評級資料真實有效。虛假描述或偽造評級將導致帳號永久封禁，本平台保留向相關執法機構舉報的權利。",
      },
      {
        heading: "4.2 拍賣取消限制",
        body: "拍賣審核通過並開始後，賣家不得無故取消拍賣。若確有不可抗力原因需要取消，須提前聯繫本平台客服審批，並提供合理解釋及相關證明。未經批准的取消將被視為違規行為，本平台保留向賣家追討因此造成損失的權利。",
      },
      {
        heading: "4.3 發貨義務",
        body: "賣家須在買家付款確認後 3 個工作日內完成發貨，並在本平台上傳有效追蹤號碼。延遲發貨或拒絕發貨將導致訂單取消、退款給買家，並扣除相應服務費。本平台對因賣家延遲發貨造成的任何損失概不負責。",
      },
      {
        heading: "4.4 商品上架規範",
        body: "賣家上架的商品須符合本平台商品政策，不得上架任何違禁品、仿冒品或侵權商品。本平台有權在不事先通知的情況下下架任何違規商品，並對相關賣家帳號採取限制措施。因上架違規商品引起的任何法律責任由賣家獨立承擔。",
      },
      {
        heading: "4.5 保留價設定",
        body: "賣家可設定保留價（最低成交價），保留價對買家不公開，僅顯示「保留價已達到╱未達到」狀態。若拍賣結束時最高出價未達保留價，拍賣視為流標，賣家不得要求買家以低於保留價的出價成交。",
      },
    ],
  },
  {
    id: "platform",
    icon: Scale,
    title: "平台責任限制",
    content: [
      {
        heading: "5.1 中介角色聲明",
        body: "本平台僅作為買賣雙方交易的技術中介，不參與實際交易，不對任何商品的品質、真偽、合法性或適銷性作出保證。買賣雙方之間的交易糾紛應由雙方自行協商解決，本平台的介入屬自願性質的調解服務。",
      },
      {
        heading: "5.2 責任免除",
        body: "在法律允許的最大範圍內，本平台對以下情況不承擔任何責任：因技術故障、伺服器中斷、網絡問題或不可抗力導致的服務中斷或數據丟失；因用戶違反本條款造成的損失；因第三方行為（包括但不限於黑客攻擊、詐騙）造成的損失；任何間接、附帶、特殊或懲罰性損害賠償。",
      },
      {
        heading: "5.3 賠償上限",
        body: "若本平台被裁定須就任何事項承擔責任，本平台的最高賠償責任不超過相關交易中本平台實際收取的服務費金額。本條款不影響任何不可依法律排除的消費者權利。",
      },
      {
        heading: "5.4 條款修改權",
        body: "本平台保留隨時修改本條款的權利，修改後的條款將在本平台公告後立即生效。繼續使用本服務即視為接受修改後的條款。如不同意修改後的條款，用戶應立即停止使用本服務。",
      },
    ],
  },
  {
    id: "timing",
    icon: Clock,
    title: "時間規則",
    content: [
      {
        heading: "6.1 拍賣時長",
        body: "賣家可設定 3 天或 7 天的拍賣時長。拍賣開始時間由賣家設定（留空則在審核通過後立即開始），系統將在設定時間自動開始競標。所有時間均以香港時間（UTC+8）為準。",
      },
      {
        heading: "6.2 結標時間",
        body: "拍賣在設定的結束時間自動結標。若觸發防狙擊機制，結標時間將相應延後。系統定期自動處理到期拍賣，本平台對因系統延遲導致的結標時間偏差（通常不超過 5 分鐘）不承擔責任。",
      },
      {
        heading: "6.3 通知時間",
        body: "系統將在以下時間點發送通知：拍賣開始時（通知所有關注者）；結束前 1 小時（通知所有出價者）；結標後立即（通知得標者及賣家）；付款後 12 小時（提醒未付款的得標者）。通知的發送依賴網絡及第三方服務，本平台對通知延誤或未送達不承擔責任。",
      },
    ],
  },
  {
    id: "legal",
    icon: FileText,
    title: "法律條款",
    content: [
      {
        heading: "7.1 適用法律",
        body: "本條款受香港特別行政區法律管轄，並依據香港法律解釋。任何因本條款或本服務引起的爭議，雙方同意提交香港法院的專屬管轄。",
      },
      {
        heading: "7.2 條款可分割性",
        body: "若本條款的任何條文被裁定為無效、不合法或不可執行，該條文應在最小必要範圍內修改，其餘條款繼續完全有效。",
      },
      {
        heading: "7.3 完整協議",
        body: "本條款連同本平台的《服務條款》及《私隱政策》構成用戶與本平台之間關於本服務的完整協議，取代雙方之前就本服務達成的所有口頭或書面協議。",
      },
      {
        heading: "7.4 語言版本",
        body: "本條款以繁體中文版本為準。如本條款有其他語言版本，以繁體中文版本為最終解釋依據。",
      },
    ],
  },
];

export default function AuctionTerms() {
  return (
    <div className="min-h-screen bg-[#06038D]">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-[#04026A]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #FEDD00 0, #FEDD00 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-10">
          <Link href="/marketplace">
            <button className="flex items-center gap-2 text-[#FEDD00]/70 hover:text-[#FEDD00] transition-colors text-sm mb-6">
              <ArrowLeft className="w-4 h-4" />
              返回市集
            </button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 bg-[#FEDD00] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#FEDD00]/20">
              <Gavel className="w-7 h-7 text-[#06038D]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black text-white tracking-tight">BOXIUM 拍賣條款</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FEDD00]/20 text-[#FEDD00] text-xs font-semibold border border-[#FEDD00]/30">
                  Auction Terms & Conditions
                </span>
              </div>
              <p className="text-white/50 text-sm mt-1">最後更新：2026 年 4 月 1 日</p>
            </div>
          </div>
          <div className="mt-6 bg-white/5 border border-[#FEDD00]/20 rounded-xl px-5 py-4 flex gap-3">
            <Info className="w-5 h-5 text-[#FEDD00] flex-shrink-0 mt-0.5" />
            <p className="text-white/70 text-sm leading-relaxed">
              參與 BOXIUM 拍賣即表示您已閱讀、理解並同意受以下所有條款約束。請在出價或上架拍賣前仔細閱讀，確保您了解所有規則、責任及限制。
            </p>
          </div>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="sticky top-0 z-10 bg-[#04026A]/95 backdrop-blur border-b border-white/10 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-[#FEDD00]/20 text-white/70 hover:text-[#FEDD00] text-xs font-medium transition-all border border-white/10 hover:border-[#FEDD00]/30"
              >
                <s.icon className="w-3 h-3" />
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        {sections.map((section, sIdx) => (
          <div
            key={section.id}
            id={section.id}
            className="rounded-2xl overflow-hidden border border-white/10 scroll-mt-16"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="w-9 h-9 bg-[#FEDD00] rounded-xl flex items-center justify-center flex-shrink-0">
                <section.icon className="w-4 h-4 text-[#06038D]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{section.title}</h2>
                <p className="text-white/40 text-xs">第 {sIdx + 1} 節</p>
              </div>
            </div>

            {/* Section Content */}
            <div className="divide-y divide-white/5">
              {section.content.map((item, idx) => (
                <div key={idx} className="px-6 py-5 hover:bg-white/3 transition-colors">
                  <h3 className="text-[#FEDD00] font-semibold text-sm mb-2">{item.heading}</h3>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Penalty Summary Table */}
        <div id="penalty-table" className="rounded-2xl overflow-hidden border border-[#FEDD00]/30 scroll-mt-16">
          <div className="px-6 py-4 border-b border-[#FEDD00]/20 flex items-center gap-3"
            style={{ background: 'rgba(254,221,0,0.08)' }}>
            <div className="w-9 h-9 bg-[#FEDD00] rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#06038D]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">違規懲罰速查表</h2>
              <p className="text-white/40 text-xs">棄標及違規行為處理標準</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold text-xs uppercase tracking-wider">違規次數</th>
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold text-xs uppercase tracking-wider">懲罰措施</th>
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold text-xs uppercase tracking-wider">封禁時長</th>
                  <th className="text-left px-6 py-3 text-[#FEDD00]/80 font-semibold text-xs uppercase tracking-wider">備注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { count: "第 1 次", action: "書面警告", duration: "無封禁", note: "永久記錄在案", color: "text-emerald-400", bg: "bg-emerald-400" },
                  { count: "第 2 次", action: "封禁競標資格", duration: "7 天", note: "可提出申訴", color: "text-amber-400", bg: "bg-amber-400" },
                  { count: "第 3 次", action: "封禁競標資格", duration: "30 天", note: "申訴機會有限", color: "text-orange-400", bg: "bg-orange-400" },
                  { count: "第 4 次及以上", action: "永久封禁", duration: "永久", note: "平台保留追討損失權利", color: "text-red-400", bg: "bg-red-400" },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-white font-semibold">{row.count}</td>
                    <td className="px-6 py-4 text-white/80">{row.action}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 font-bold ${row.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.bg}`} />
                        {row.duration}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/50 text-xs">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Shield, title: "平台保障", desc: "本平台作為中介，對商品真偽及交易結果不承擔保證責任，但提供爭議調解服務。" },
            { icon: Scale, title: "公平交易", desc: "所有出價具法律約束力，防狙擊機制確保公平競標，違規行為將受到相應處理。" },
            { icon: Clock, title: "時效要求", desc: "得標後 24 小時內付款，賣家付款確認後 3 個工作日內發貨，逾期將受處分。" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-white/10 px-5 py-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="w-4 h-4 text-[#FEDD00]" />
                <span className="text-white font-semibold text-sm">{item.title}</span>
              </div>
              <p className="text-white/55 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="rounded-xl border border-white/10 px-6 py-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-white/40 text-xs leading-relaxed text-center">
            BOXIUM 保留隨時修改本條款的權利，修改後將通過站內通知告知用戶，並在本頁面更新「最後更新」日期。
            繼續使用 BOXIUM 拍賣服務即視為接受最新條款。如有疑問，請透過本平台客服渠道聯繫我們。
            <br /><span className="mt-1 block">© 2026 BOXIUM. All rights reserved.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
