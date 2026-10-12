export function getCurrencyName(currency, localCurrency) {
  return currency === 'USD' ? 'دولار' : localCurrency?.nameAr || 'العملة المحلية'
}

export function formatMoney(value, currency, localCurrency) {
  const amount = Number(value ?? 0)
  const suffix = getCurrencyName(currency, localCurrency)
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${suffix}`
}

const currencySalesReportNames = {
  EGP: 'المبيعات بالجنيه المصري',
  LYD: 'المبيعات بالدينار الليبي',
  DZD: 'المبيعات بالدينار الجزائري',
  AED: 'المبيعات بالدرهم الإماراتي',
  KWD: 'المبيعات بالدينار الكويتي',
  IQD: 'المبيعات بالدينار العراقي',
  SAR: 'المبيعات بالريال السعودي',
  OMR: 'المبيعات بالريال العُماني',
  TND: 'المبيعات بالدينار التونسي',
  MAD: 'المبيعات بالدرهم المغربي',
  QAR: 'المبيعات بالريال القطري',
}

export function getLocalCurrencySalesReportName(localCurrency) {
  return currencySalesReportNames[localCurrency?.code] || 'المبيعات بالعملة المحلية'
}
