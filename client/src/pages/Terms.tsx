import { MainLayout } from "@/components/MainLayout";
import { GlobalNav } from "@/components/GlobalNav";

export default function Terms() {
  return (
    <>
      <GlobalNav />
      <MainLayout>
        <div className="min-h-screen py-12 px-4" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 md:p-12">
            <h1 className="text-4xl font-bold mb-8" style={{ color: "#06038d" }}>
              服務條款
            </h1>
            
            <div className="space-y-8 text-gray-700 leading-relaxed">
              <section>
                <p className="text-sm text-gray-500 mb-6">最後更新日期：2026 年 2 月 14 日</p>
                
                <p className="mb-4">
                  歡迎使用 Boxium（以下簡稱「本平台」）。本服務條款（以下簡稱「本條款」）規範您使用本平台所提供之服務的權利與義務。當您使用本平台時，即表示您已閱讀、瞭解並同意接受本條款之所有內容。若您不同意本條款的任何內容，請勿使用本平台。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  一、服務內容
                </h2>
                <p className="mb-4">
                  Boxium 是一個專為 Pokémon Trading Card Game（PTCG）愛好者和收藏家設計的卡牌價格資訊平台。本平台整合全球多個市場的數據來源，為用戶提供即時、準確的卡牌價格資訊、價格趨勢分析及市場研究工具。
                </p>
                <p className="mb-4">
                  本平台提供的服務包括但不限於：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>卡牌價格查詢與比較</li>
                  <li>價格歷史趨勢圖表</li>
                  <li>市場數據分析與研究工具</li>
                  <li>收藏夾功能</li>
                  <li>價格提醒通知（如適用）</li>
                </ul>
                <p>
                  本平台保留隨時修改、暫停或終止全部或部分服務的權利，且無需事先通知用戶。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  二、用戶責任
                </h2>
                <p className="mb-4">
                  使用本平台時，您同意遵守以下規範：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>不得使用本平台從事任何違法或侵害他人權益的行為</li>
                  <li>不得干擾或破壞本平台的正常運作</li>
                  <li>不得未經授權存取本平台的系統或數據</li>
                  <li>不得使用自動化工具（如爬蟲程式）大量抓取本平台數據</li>
                  <li>不得將本平台提供的資訊用於商業用途，除非獲得本平台書面同意</li>
                </ul>
                <p>
                  若您違反上述規範，本平台有權立即暫停或終止您的使用權限，且無需承擔任何責任。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  三、資訊準確性與免責聲明
                </h2>
                <p className="mb-4">
                  本平台致力於提供準確、即時的卡牌價格資訊，但由於市場價格波動、數據來源延遲或技術限制等因素，本平台無法保證所提供資訊的完全準確性、即時性或完整性。
                </p>
                <p className="mb-4">
                  <strong>本平台提供的價格資訊僅供參考，不構成任何投資建議或交易建議。</strong>用戶應自行判斷並承擔使用本平台資訊所產生的一切風險與責任。本平台對於用戶因使用或無法使用本平台服務而遭受的任何直接、間接、附帶、特殊或衍生性損失，概不負責。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  四、智慧財產權
                </h2>
                <p className="mb-4">
                  本平台的所有內容，包括但不限於文字、圖片、圖表、標誌、介面設計、程式碼及數據編排，均受著作權法、商標法及其他智慧財產權法律保護。未經本平台書面同意，您不得複製、修改、散布、展示、出版或以其他方式使用本平台的任何內容。
                </p>
                <p>
                  Pokémon、Pokémon Trading Card Game 及相關商標為 The Pokémon Company 的註冊商標。本平台與 The Pokémon Company 無任何官方關聯或授權關係。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  五、第三方連結
                </h2>
                <p className="mb-4">
                  本平台可能包含指向第三方網站或服務的連結。這些連結僅為方便用戶而提供，本平台對第三方網站的內容、隱私政策或做法概不負責。用戶訪問第三方網站時，應自行承擔相關風險。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  六、隱私權保護
                </h2>
                <p className="mb-4">
                  本平台重視用戶的隱私權保護。關於本平台如何收集、使用及保護您的個人資料，請參閱我們的<a href="/privacy" className="text-blue-600 hover:underline">隱私權政策</a>。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  七、條款修改
                </h2>
                <p className="mb-4">
                  本平台保留隨時修改本條款的權利。修改後的條款將公布於本頁面，並註明最後更新日期。若您在條款修改後繼續使用本平台，即表示您同意接受修改後的條款。建議您定期查閱本頁面以瞭解最新的服務條款。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  八、準據法與管轄權
                </h2>
                <p className="mb-4">
                  本條款之解釋、效力及履行，均應依照中華民國法律。因本條款所生之爭議，雙方同意以台灣台北地方法院為第一審管轄法院。
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#06038d" }}>
                  九、聯絡我們
                </h2>
                <p className="mb-4">
                  若您對本服務條款有任何疑問或建議，歡迎透過以下方式與我們聯繫：
                </p>
                <p className="ml-4">
                  電子郵件：support@boxium.com
                </p>
              </section>

              <div className="mt-12 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center">
                  © 2026 Boxium. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </>
  );
}
