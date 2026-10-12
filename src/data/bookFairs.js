export const ACTIVE_BOOK_FAIR_KEY = 'tanmia.activeBookFairId.v1'

const countryNamesAr = {
  EGYPT: 'مصر',
  LIBYA: 'ليبيا',
  ALGERIA: 'الجزائر',
  UAE: 'الإمارات',
  KUWAIT: 'الكويت',
  IRAQ: 'العراق',
  SA: 'السعودية',
  OMAN: 'عُمان',
  TUNISIA: 'تونس',
  MOROCCO: 'المغرب',
  QATAR: 'قطر',
}

const currencyDetails = {
  EGP: { code: 'EGP', nameAr: 'جنيه مصري', symbol: 'ج.م' },
  LYD: { code: 'LYD', nameAr: 'دينار ليبي', symbol: 'د.ل' },
  DZD: { code: 'DZD', nameAr: 'دينار جزائري', symbol: 'د.ج' },
  AED: { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ' },
  KWD: { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك' },
  IQD: { code: 'IQD', nameAr: 'دينار عراقي', symbol: 'د.ع' },
  SAR: { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س' },
  OMR: { code: 'OMR', nameAr: 'ريال عُماني', symbol: 'ر.ع' },
  TND: { code: 'TND', nameAr: 'دينار تونسي', symbol: 'د.ت' },
  MAD: { code: 'MAD', nameAr: 'درهم مغربي', symbol: 'د.م' },
  QAR: { code: 'QAR', nameAr: 'ريال قطري', symbol: 'ر.ق' },
  USD: { code: 'USD', nameAr: 'دولار أمريكي', symbol: '$' },
}

export function translateCountry(countryCode) {
  return countryNamesAr[countryCode] || countryCode
}

export function getCurrencyDetails(currencyCode) {
  return currencyDetails[currencyCode] || { code: currencyCode || '', nameAr: currencyCode || 'العملة المحلية', symbol: '' }
}

export function normalizeBookFair(bookFair) {
  if (!bookFair) return null
  return {
    ...bookFair,
    localCurrency: getCurrencyDetails(bookFair.primaryCurrency),
  }
}
