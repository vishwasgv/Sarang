import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import hi from './locales/hi.json'
import kn from './locales/kn.json'
import ta from './locales/ta.json'
import te from './locales/te.json'
import ml from './locales/ml.json'
import mr from './locales/mr.json'
import gu from './locales/gu.json'
import es from './locales/es.json'
import ar from './locales/ar.json'
import fr from './locales/fr.json'
import pt from './locales/pt.json'
import id from './locales/id.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',    nativeName: 'English',     rtl: false, flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिंदी',        rtl: false, flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi',    nativeName: 'मराठी',        rtl: false, flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati',   nativeName: 'ગુજરાતી',      rtl: false, flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada',    nativeName: 'ಕನ್ನಡ',        rtl: false, flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil',      nativeName: 'தமிழ்',        rtl: false, flag: '🇮🇳' },
  { code: 'te', name: 'Telugu',     nativeName: 'తెలుగు',       rtl: false, flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam',  nativeName: 'മലയാളം',      rtl: false, flag: '🇮🇳' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',     rtl: false, flag: '🇪🇸' },
  { code: 'fr', name: 'French',     nativeName: 'Français',    rtl: false, flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',   rtl: false, flag: '🇧🇷' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',     rtl: true,  flag: '🇸🇦' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', rtl: false, flag: '🇮🇩' }
] as const

export type LangCode = typeof SUPPORTED_LANGUAGES[number]['code']

const savedLang = (typeof localStorage !== 'undefined' && localStorage.getItem('sarang_lang')) || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      kn: { translation: kn },
      ta: { translation: ta },
      te: { translation: te },
      ml: { translation: ml },
      mr: { translation: mr },
      gu: { translation: gu },
      es: { translation: es },
      ar: { translation: ar },
      fr: { translation: fr },
      pt: { translation: pt },
      id: { translation: id }
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  })

export function setLanguage(code: LangCode) {
  i18n.changeLanguage(code)
  localStorage.setItem('sarang_lang', code)

  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code)
  const dir = lang?.rtl ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', code)
}

// Apply direction on init
const initLang = SUPPORTED_LANGUAGES.find(l => l.code === savedLang)
if (initLang?.rtl) {
  document.documentElement.setAttribute('dir', 'rtl')
  document.documentElement.setAttribute('lang', savedLang)
}

export { i18n }
