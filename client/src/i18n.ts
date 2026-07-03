import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // 不再 inline resources，改由 Backend 動態 fetch /locales/<lng>.json
    backend: {
      loadPath: '/locales/{{lng}}.json',
    },
    fallbackLng: 'zh-TW',
    lng: 'zh-TW', // 預設語言為繁體中文
    supportedLngs: ['zh-TW', 'en', 'ja'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    // initImmediate: false 確保 i18n 初始化完成後才渲染，避免 key 閃爍
    initImmediate: false,
  });

export default i18n;
