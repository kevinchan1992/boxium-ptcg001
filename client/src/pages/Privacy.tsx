import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";

export default function Privacy() {
  return (
    <>
    <PageHead 
      title="隱私權政策 - BOXIUM PTCG 寶可夢卡牌市場數據平台"
      description="BOXIUM PTCG 平台隱私權政策，說明我們如何收集、使用、揭露及保護您的個人資料，以及您的權利與選擇。"
      keywords="隱私權政策, 個人資料保護, BOXIUM, PTCG, 寶可夢卡牌, 數據安全"
    />
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 sm:p-8 md:p-12">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="h-16 sm:h-20 md:h-24"
              />
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 sm:mb-8" style={{ color: "#06038d" }}>
              隱私權政策
            </h1>
            
            <div className="space-y-8 text-gray-700 leading-relaxed">
              <section>
                <p className="text-sm text-gray-500 mb-6">最後更新日期：2026 年 2 月 14 日</p>
                
                <p className="mb-4">
                  Boxium（以下簡稱「本平台」、「我們」）重視您的隱私權保護。本隱私權政策（以下簡稱「本政策」）說明我們如何收集、使用、揭露及保護您在使用本平台服務時所提供的個人資料。請您仔細閱讀本政策，以瞭解我們對於個人資料的處理方式。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  一、個人資料的收集
                </h2>
                <p className="mb-4">
                  當您使用本平台服務時，我們可能會收集以下類型的個人資料：
                </p>
                
                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6">1.1 您主動提供的資料</h3>
                <p className="mb-4">
                  當您註冊帳號、使用特定功能或與我們聯繫時，您可能會主動提供以下資料：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>電子郵件地址</li>
                  <li>使用者名稱</li>
                  <li>個人偏好設定（如收藏的卡牌、價格提醒設定等）</li>
                  <li>您在使用本平台功能時輸入的其他資訊</li>
                </ul>

                <h3 className="text-lg sm:text-xl font-semibold mb-3 mt-6">1.2 自動收集的資料</h3>
                <p className="mb-4">
                  當您訪問或使用本平台時，我們會自動收集某些技術資訊，包括：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>IP 位址</li>
                  <li>瀏覽器類型與版本</li>
                  <li>作業系統</li>
                  <li>訪問時間與日期</li>
                  <li>瀏覽的頁面與功能使用記錄</li>
                  <li>Cookie 及類似技術所收集的資訊</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  二、個人資料的使用目的
                </h2>
                <p className="mb-4">
                  我們收集您的個人資料主要用於以下目的：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li><strong>提供服務：</strong>為您提供卡牌價格查詢、價格趨勢分析、收藏夾管理等核心服務</li>
                  <li><strong>改善服務：</strong>分析用戶行為與偏好，優化平台功能與使用者體驗</li>
                  <li><strong>個人化體驗：</strong>根據您的偏好提供客製化的內容與建議</li>
                  <li><strong>通知與溝通：</strong>向您發送服務更新、價格提醒或其他重要通知</li>
                  <li><strong>安全維護：</strong>偵測、預防及處理詐欺、濫用或其他違法行為</li>
                  <li><strong>法律遵循：</strong>遵守適用的法律、法規或法院命令</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  三、個人資料的揭露與分享
                </h2>
                <p className="mb-4">
                  我們不會出售您的個人資料給第三方。在以下情況下，我們可能會揭露或分享您的個人資料：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li><strong>服務提供商：</strong>我們可能與協助我們提供服務的第三方服務提供商分享您的資料（如雲端儲存服務、數據分析工具等）。這些服務提供商僅能在提供服務的範圍內使用您的資料，並須遵守保密義務</li>
                  <li><strong>法律要求：</strong>當法律、法規、法院命令或政府機關要求時，我們可能需要揭露您的資料</li>
                  <li><strong>保護權益：</strong>為保護本平台、用戶或公眾的權利、財產或安全，我們可能需要揭露您的資料</li>
                  <li><strong>業務轉讓：</strong>若本平台發生合併、收購或資產出售，您的個人資料可能會作為業務資產的一部分被轉讓</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  四、Cookie 與追蹤技術
                </h2>
                <p className="mb-4">
                  本平台使用 Cookie 及類似的追蹤技術來改善您的使用體驗。Cookie 是儲存在您裝置上的小型文字檔案，用於記錄您的偏好設定、登入狀態及使用行為。
                </p>
                <p className="mb-4">
                  我們使用的 Cookie 類型包括：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li><strong>必要性 Cookie：</strong>這些 Cookie 對於本平台的基本功能運作是必需的，例如維持您的登入狀態</li>
                  <li><strong>功能性 Cookie：</strong>這些 Cookie 用於記住您的偏好設定，提供更個人化的體驗</li>
                  <li><strong>分析性 Cookie：</strong>這些 Cookie 幫助我們瞭解用戶如何使用本平台，以便改善服務</li>
                </ul>
                <p className="mb-4">
                  您可以透過瀏覽器設定來管理或刪除 Cookie。但請注意，若您停用 Cookie，可能會影響本平台的部分功能。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  五、資料安全
                </h2>
                <p className="mb-4">
                  我們採取合理的技術與組織措施來保護您的個人資料，防止未經授權的存取、使用、揭露、修改或破壞。這些措施包括但不限於：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>使用加密技術保護資料傳輸</li>
                  <li>限制員工及服務提供商對個人資料的存取權限</li>
                  <li>定期檢視並更新安全措施</li>
                </ul>
                <p className="mb-4">
                  然而，請注意，沒有任何網路傳輸或電子儲存方式是百分之百安全的。儘管我們盡力保護您的資料，但無法保證絕對的安全性。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  六、資料保存期限
                </h2>
                <p className="mb-4">
                  我們僅在達成收集目的所需的期間內保存您的個人資料。當您的資料不再需要時，我們會安全地刪除或匿名化處理。具體的保存期限取決於資料類型及使用目的，例如：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li>帳號資料：在您的帳號有效期間及帳號刪除後的合理期間內保存</li>
                  <li>使用記錄：通常保存 12 至 24 個月</li>
                  <li>法律要求的資料：依照法律規定的期限保存</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  七、您的權利
                </h2>
                <p className="mb-4">
                  根據適用的個人資料保護法律，您對於您的個人資料享有以下權利：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                  <li><strong>查詢權：</strong>您有權查詢我們持有的您的個人資料</li>
                  <li><strong>更正權：</strong>若您的個人資料不正確或不完整，您有權要求更正</li>
                  <li><strong>刪除權：</strong>在特定情況下，您有權要求刪除您的個人資料</li>
                  <li><strong>限制處理權：</strong>在特定情況下，您有權要求限制我們對您個人資料的處理</li>
                  <li><strong>資料可攜權：</strong>您有權要求以結構化、常用且機器可讀的格式接收您的個人資料</li>
                  <li><strong>反對權：</strong>您有權反對我們基於合法利益處理您的個人資料</li>
                </ul>
                <p className="mb-4">
                  若您希望行使上述權利，請透過以下聯絡方式與我們聯繫。我們會在合理期限內回應您的請求。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  八、兒童隱私
                </h2>
                <p className="mb-4">
                  本平台的服務對象為一般大眾，我們不會故意收集 13 歲以下兒童的個人資料。若您是家長或監護人，並發現您的孩子在未經您同意的情況下向我們提供了個人資料，請與我們聯繫，我們將盡快刪除相關資料。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  九、跨境資料傳輸
                </h2>
                <p className="mb-4">
                  您的個人資料可能會被傳輸至您所在國家或地區以外的地方進行處理或儲存。我們會確保這些資料傳輸符合適用的個人資料保護法律，並採取適當的保護措施。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  十、政策修改
                </h2>
                <p className="mb-4">
                  我們可能會不時修改本隱私權政策。修改後的政策將公布於本頁面，並註明最後更新日期。若修改內容重大，我們會透過電子郵件或平台通知的方式告知您。建議您定期查閱本頁面以瞭解最新的隱私權政策。
                </p>
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  十一、聯絡我們
                </h2>
                <p className="mb-4">
                  若您對本隱私權政策有任何疑問、意見或希望行使您的個人資料權利，歡迎透過以下方式與我們聯繫：
                </p>
                <p className="ml-4 mb-2">
                  電子郵件：privacy@boxium.com
                </p>
                <p className="ml-4">
                  客服信箱：support@boxium.com
                </p>
              </section>

            </div>
          </div>
      
      {/* Footer */}
      <Footer />
    </div>
    </>
  );
}
