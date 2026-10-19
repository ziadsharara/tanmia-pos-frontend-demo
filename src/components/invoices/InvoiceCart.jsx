import { Icon } from '../ui/Icon.jsx'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'

function NumberField({ className = '', name, label, value, onChange, min = 0, max, step = '1', disabled }) {
  return <label className={`compact-field ${className}`}><span>{label}</span><input name={name} autoComplete="off" type="number" dir="ltr" inputMode="decimal" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => {
    const nextValue = event.target.value
    if (nextValue !== '' && min !== undefined && Number(nextValue) < Number(min)) return
    if (nextValue !== '' && max !== undefined && Number(nextValue) > Number(max)) return
    onChange(nextValue)
  }} /></label>
}

function MoneyValue({ value, currency, localCurrency }) {
  const [amount, ...unitParts] = formatMoney(value, currency, localCurrency).split(' ')
  return <strong className="invoice-money"><bdi dir="ltr">{amount}</bdi><span>{unitParts.join(' ')}</span></strong>
}

export function InvoiceCart({ items, currency, calculation, disabled, onChange, onRemove, localCurrency }) {
  const calculations = new Map((calculation?.items || []).map((item) => [item.bookId, item]))

  if (items.length === 0) {
    return <div className="invoice-empty"><span className="catalog-state__icon"><Icon name="cart" size={28} /></span><strong>الفاتورة لسه فاضية</strong><p>امسح كود الكتاب أو دور بالاسم، وبعدها اختاره من النتائج.</p></div>
  }

  return (
    <div className="invoice-lines" aria-label="كتب الفاتورة">
      {items.map((item) => {
        const calculated = calculations.get(item.book.id)
        const unitPrice = calculated?.unitPrice ?? (currency === 'USD' ? item.book.priceInUSD : item.book.price)
        const originalQuantity = Number(item.originalQuantity || 0)
        const currentStock = Number(item.book.quantity) - originalQuantity
        return (
          <article className="invoice-line" key={item.book.id}>
            <div className="invoice-line__book"><strong>{item.book.name}</strong><span>{item.book.author}</span><small dir="ltr">{item.book.code}</small><small>{originalQuantity > 0 ? `المخزون الحالي: ${currentStock} نسخة · الحد لهذه الفاتورة: ${item.book.quantity} نسخ` : `المتاح: ${item.book.quantity} نسخة`}</small></div>
            <div className="invoice-line__price"><span>سعر الوحدة</span><MoneyValue value={unitPrice} currency={currency} localCurrency={localCurrency} /></div>
            <NumberField className="invoice-line__quantity" name={`quantity-${item.book.id}`} label="الكمية" min="1" max={item.book.quantity} step="1" value={item.quantity} disabled={disabled} onChange={(value) => onChange(item.book.id, 'quantity', value)} />
            <NumberField className="invoice-line__percentage" name={`discount-percentage-${item.book.id}`} label="خصم %" max="100" step="0.01" value={item.discountPercentage} disabled={disabled} onChange={(value) => onChange(item.book.id, 'discountPercentage', value)} />
            <NumberField className="invoice-line__fixed" name={`fixed-discount-${item.book.id}`} label={`خصم ثابت ${getCurrencyName(currency, localCurrency)}`} step="0.01" value={item.fixedDiscountAmount} disabled={disabled} onChange={(value) => onChange(item.book.id, 'fixedDiscountAmount', value)} />
            <div className="invoice-line__total"><span>إجمالي السطر</span>{calculated ? <MoneyValue value={calculated.totalAfterItemDiscounts} currency={currency} localCurrency={localCurrency} /> : <strong>—</strong>}</div>
            <button className="icon-button invoice-line__remove" type="button" aria-label={`حذف ${item.book.name}`} disabled={disabled} onClick={() => onRemove(item.book.id)}><Icon name="trash" size={17} /></button>
          </article>
        )
      })}
    </div>
  )
}
