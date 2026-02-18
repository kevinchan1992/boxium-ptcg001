import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type LegalPage = 'terms' | 'privacy';

export function useLegalTranslation(page: LegalPage) {
  const { i18n } = useTranslation();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTranslation = async () => {
      setLoading(true);
      try {
        const lang = i18n.language;
        const translation = await import(`../locales/${page}/${lang}.json`);
        setContent(translation.default || translation);
      } catch (error) {
        console.error(`Failed to load ${page} translation for ${i18n.language}:`, error);
        // Fallback to zh-TW if translation not found
        try {
          const fallback = await import(`../locales/${page}/zh-TW.json`);
          setContent(fallback.default || fallback);
        } catch (fallbackError) {
          console.error(`Failed to load fallback translation:`, fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadTranslation();
  }, [i18n.language, page]);

  return { content, loading };
}
