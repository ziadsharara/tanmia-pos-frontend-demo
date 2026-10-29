export const libraryEntryLabels = {
  OPENING_BALANCE: 'رصيد افتتاحي',
  LEGACY_PAYMENT: 'دفعة سابقة مسجلة بالفاتورة',
  LEGACY_ADJUSTMENT: 'تسوية الرصيد السابق',
  INVOICE: 'فاتورة بيع',
  INVOICE_ADJUSTMENT: 'تعديل فاتورة',
  PAYMENT: 'دفعة مستلمة',
  RETURN: 'مرتجع كتب للمكتبة',
  REFUND: 'مبلغ مردود للمكتبة',
  INVOICE_CANCELLATION: 'إلغاء فاتورة',
}

export function businessToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function validateLibraryPayment({ amount, paymentMethod, paidAt, notes }, openingDate) {
  const number = Number(amount)
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(String(amount)) || !Number.isFinite(number)
    || number <= 0 || !Number.isSafeInteger(Math.round(number * 100))) return 'اكتب مبلغاً أكبر من صفر، بحد أقصى منزلتين عشريتين.'
  if (!['CASH', 'VISA'].includes(paymentMethod)) return 'اختار طريقة الدفع.'
  if (!paidAt || paidAt > businessToday()) return 'اختار تاريخ دفع صحيح لا يتجاوز اليوم.'
  if (openingDate && paidAt < openingDate) return 'تاريخ الدفع لا يمكن أن يسبق تاريخ فتح الحساب.'
  if ((notes || '').length > 500) return 'الملاحظات لا تتجاوز 500 حرف.'
  return ''
}

export function libraryAccountError(error, fallback) {
  if (error?.status === 503) return 'جاري تجهيز بيانات الحساب السابقة. حدّث الصفحة بعد اكتمال تشغيل السيرفر.'
  if (error?.status === 404) return 'المكتبة غير موجودة في المعرض الحالي. حدّث قائمة المكتبات.'
  if (error?.status === 409) return 'رقم الدفعة مستخدم بالفعل ببيانات مختلفة. راجع كشف الحساب قبل تسجيل دفعة أخرى.'
  if (error?.status === 400) return 'راجع المبلغ وتاريخ الدفع والعملة وحاول تاني.'
  return fallback
}


export function libraryBalanceLabel(value) {
  const amount = Number(value || 0)
  return amount < 0 ? 'رصيد لصالح المكتبة عندنا' : amount > 0 ? 'مطلوب تحصيله من المكتبة' : 'الحساب متعادل'
}

export function libraryReturnEffect(returned, refunded) {
  return Math.round((Number(returned || 0) - Number(refunded || 0)) * 100) / 100
}
