import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Mail, MessageSquare, Facebook, Instagram, MapPin, Clock, ChevronRight, Send, CheckCircle } from "lucide-react";
import Footer from "@/components/Footer";

export default function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate form submission (redirect to email)
    await new Promise((r) => setTimeout(r, 800));
    const mailtoUrl = `mailto:boxium.asia@gmail.com?subject=${encodeURIComponent(form.subject || "聯絡 BOXIUM")}&body=${encodeURIComponent(`姓名：${form.name}\n電郵：${form.email}\n\n${form.message}`)}`;
    window.location.href = mailtoUrl;
    setSubmitting(false);
    setSubmitted(true);
  };

  const contactChannels = [
    {
      icon: Mail,
      title: "電子郵件",
      value: "boxium.asia@gmail.com",
      desc: "一般查詢及技術支援",
      href: "mailto:boxium.asia@gmail.com",
      color: "#06038d",
    },
    {
      icon: Facebook,
      title: "Facebook",
      value: "BOXIUM PTCG",
      desc: "追蹤最新消息與活動",
      href: "https://www.facebook.com/share/18ENwGABRe/?mibextid=wwXIfr",
      color: "#1877F2",
    },
    {
      icon: Instagram,
      title: "Instagram",
      value: "@boxium.gamecard",
      desc: "卡牌開箱與市場動態",
      href: "https://www.instagram.com/boxium.gamecard?igsh=MTBha2wyNWR4d3lpcQ%3D%3D&utm_source=qr",
      color: "#E1306C",
    },
  ];

  const faqs = [
    {
      q: "如何成為賣家？",
      a: "登入後前往「我的賣場」，完成 Stripe Connect 認證即可開始上架商品。",
    },
    {
      q: "交易出現問題怎麼辦？",
      a: "請透過訂單頁面的「聯絡賣家」功能溝通，或直接發送電郵至 boxium.asia@gmail.com。",
    },
    {
      q: "如何申請 PSA 鑑定服務？",
      a: "前往「PSA 鑑定」頁面填寫申請表格，我們的團隊將在 1-2 個工作天內回覆。",
    },
    {
      q: "數據更新頻率是多少？",
      a: "我們的系統每 12 小時自動更新一次價格數據，確保您獲得最新的市場資訊。",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f8f9fa" }}>
      {/* Hero Banner */}
      <section style={{ backgroundColor: "#06038d" }} className="pt-16 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Breadcrumb */}
          <div className="flex items-center justify-center gap-1.5 text-white/50 text-xs mb-6">
            <Link href="/" className="hover:text-[#FEDD00] transition-colors">首頁</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/80">聯絡我們</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#FEDD00]/10 border border-[#FEDD00]/30 rounded-full px-4 py-1.5 text-[#FEDD00] text-xs font-semibold uppercase tracking-widest mb-5">
            <MessageSquare className="w-3.5 h-3.5" />
            Contact Us
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3 leading-tight">
            有任何問題？<br className="sm:hidden" />
            <span style={{ color: "#FEDD00" }}>我們隨時為您服務</span>
          </h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            無論是交易問題、功能建議或合作洽詢，歡迎透過以下方式與 BOXIUM 團隊聯繫。
          </p>
        </div>
      </section>

      {/* Yellow accent bar */}
      <div className="w-full h-1" style={{ backgroundColor: "#FEDD00" }} />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

          {/* Left: Contact Channels + FAQ */}
          <div className="lg:col-span-2 space-y-8">
            {/* Contact Channels */}
            <div>
              <h2 className="text-base font-bold mb-4" style={{ color: "#06038d" }}>
                聯絡管道
              </h2>
              <div className="space-y-3">
                {contactChannels.map((ch) => (
                  <a
                    key={ch.title}
                    href={ch.href}
                    target={ch.href.startsWith("mailto") ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-[#06038d]/30 hover:shadow-md transition-all duration-200"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: `${ch.color}15` }}
                    >
                      <ch.icon className="w-5 h-5" style={{ color: ch.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 font-medium mb-0.5">{ch.title}</div>
                      <div className="text-sm font-bold text-gray-800 truncate">{ch.value}</div>
                      <div className="text-xs text-gray-500">{ch.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#06038d] transition-colors flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>

            {/* Response Time */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" style={{ color: "#06038d" }} />
                <h3 className="text-sm font-bold" style={{ color: "#06038d" }}>回覆時間</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>電郵查詢</span>
                  <span className="font-semibold text-gray-800">1–2 個工作天</span>
                </div>
                <div className="flex justify-between">
                  <span>Facebook / Instagram</span>
                  <span className="font-semibold text-gray-800">通常 24 小時內</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-500">服務時間：週一至週五 10:00–18:00 (HKT)</span>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-base font-bold mb-4" style={{ color: "#06038d" }}>
                常見問題
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <details
                    key={i}
                    className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer px-4 py-3.5 text-sm font-semibold text-gray-800 list-none hover:bg-gray-50 transition-colors">
                      {faq.q}
                      <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform duration-200 flex-shrink-0 ml-2" />
                    </summary>
                    <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              {/* Form header */}
              <div className="px-6 py-5 border-b border-gray-100" style={{ backgroundColor: "#06038d" }}>
                <h2 className="text-lg font-bold text-white">發送訊息</h2>
                <p className="text-white/60 text-sm mt-0.5">填寫表格，我們將盡快回覆您</p>
              </div>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#06038d15" }}>
                    <CheckCircle className="w-8 h-8" style={{ color: "#06038d" }} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">訊息已送出！</h3>
                  <p className="text-gray-500 text-sm max-w-xs">
                    感謝您的留言，我們將在 1–2 個工作天內透過電郵回覆您。
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                    className="mt-6 text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                    style={{ backgroundColor: "#06038d", color: "white" }}
                  >
                    再次發送
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        姓名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="您的姓名"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#06038d] focus:ring-2 focus:ring-[#06038d]/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        電郵地址 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="your@email.com"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#06038d] focus:ring-2 focus:ring-[#06038d]/10 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      主題
                    </label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#06038d] focus:ring-2 focus:ring-[#06038d]/10 transition-all bg-white"
                    >
                      <option value="">請選擇主題</option>
                      <option value="交易問題">交易問題</option>
                      <option value="帳號問題">帳號問題</option>
                      <option value="PSA 鑑定查詢">PSA 鑑定查詢</option>
                      <option value="數據問題">數據問題</option>
                      <option value="功能建議">功能建議</option>
                      <option value="商業合作">商業合作</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      訊息內容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="請詳細描述您的問題或建議..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#06038d] focus:ring-2 focus:ring-[#06038d]/10 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                    style={{ backgroundColor: "#06038d", color: "white" }}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        發送中...
                      </span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        發送訊息
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    點擊「發送訊息」將開啟您的電郵應用程式。您也可以直接發送電郵至{" "}
                    <a href="mailto:boxium.asia@gmail.com" className="underline hover:text-[#06038d]">
                      boxium.asia@gmail.com
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
