import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import StructuredData from "@/components/StructuredData";
import { useLegalTranslation } from "@/hooks/useLegalTranslation";
import { Link } from "wouter";

export default function Terms() {
  const { content, loading } = useLegalTranslation('terms');
  
  // Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service - BOXIUM TCG",
    "description": "BOXIUM TCG Platform Terms of Service",
    "url": "https://boxiumptcg.manus.space/terms",
    "isPartOf": {
      "@type": "WebSite",
      "name": "BOXIUM TCG",
      "url": "https://boxiumptcg.manus.space"
    }
  };

  if (loading || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <StructuredData data={structuredData} />
      <PageHead 
        title={`${content.title} - BOXIUM TCG`}
        description="BOXIUM TCG Terms of Service"
        keywords="Terms of Service, BOXIUM, PTCG, Pokemon Cards"
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
            {content.title}
          </h1>
          
          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <p className="text-sm text-gray-500 mb-6">{content.lastUpdated}</p>
              <p className="mb-4">{content.intro}</p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section1.title}
              </h2>
              <p className="mb-4">{content.section1.p1}</p>
              <p className="mb-4">{content.section1.p2}</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                {content.section1.services.map((service: string, index: number) => (
                  <li key={index}>{service}</li>
                ))}
              </ul>
              <p>{content.section1.p3}</p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section2.title}
              </h2>
              <p className="mb-4">{content.section2.p1}</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                {content.section2.rules.map((rule: string, index: number) => (
                  <li key={index}>{rule}</li>
                ))}
              </ul>
              <p>{content.section2.p2}</p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section3.title}
              </h2>
              <p className="mb-4">{content.section3.p1}</p>
              {content.section3.subsection1 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2" style={{ color: "#06038d" }}>{content.section3.subsection1.title}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    {content.section3.subsection1.items.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {content.section3.subsection2 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2" style={{ color: "#06038d" }}>{content.section3.subsection2.title}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    {content.section3.subsection2.items.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {content.section3.subsection3 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2" style={{ color: "#06038d" }}>{content.section3.subsection3.title}</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    {content.section3.subsection3.items.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section4.title}
              </h2>
              <p className="mb-4">{content.section4.p1}</p>
              {content.section4.p2 && <p className="mb-2">{content.section4.p2}</p>}
              {content.section4.p3 && <p>{content.section4.p3}</p>}
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section5.title}
              </h2>
              <p className="mb-4">{content.section5.p1}</p>
              {content.section5.p2 && <p className="mb-2 font-medium">{content.section5.p2}</p>}
              {content.section5.refundPolicy && (
                <ul className="list-disc list-inside space-y-2 ml-4">
                  {content.section5.refundPolicy.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section6.title}
              </h2>
              <p className="mb-4">
                {content.section6.p1}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  {content.section6.privacyLink}
                </Link>
                。
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section7.title}
              </h2>
              <p className="mb-4">{content.section7.p1}</p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section8.title}
              </h2>
              <p className="mb-4">{content.section8.p1}</p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                {content.section9.title}
              </h2>
              <p className="mb-4">{content.section9.p1}</p>
            </section>

            {/* Section 10 */}
            {content.section10 && (
              <section>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4" style={{ color: "#06038d" }}>
                  {content.section10.title}
                </h2>
                <p className="mb-4">{content.section10.p1}</p>
                <p className="ml-4 font-medium">{content.section10.email}</p>
              </section>
            )}
          </div>
        </div>
    
        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
