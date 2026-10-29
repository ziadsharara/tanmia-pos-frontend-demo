import { useEffect, useRef, useState } from 'react'
import { exportDailyLibraryRecords } from '../../api/libraries.js'
import { libraryAccountError } from '../../utils/libraryAccounts.js'
import { getCurrencyName } from '../../utils/currency.js'
import { Icon } from '../ui/Icon.jsx'

export function LibraryRecordsExportButton({ library, bookFair, currency, isActive, onNotice, date, from, to, canExport = true, exportType, label }) {
  const [exporting, setExporting] = useState(false)
  const pending = useRef(null)

  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => {
    if (!isActive) pending.current?.abort()
  }, [isActive])

  const handleExport = async (event) => {
    event.preventDefault()
    if (!canExport || pending.current || !isActive) return
    const controller = new AbortController()
    pending.current = controller
    setExporting(true)
    try {
      const file = await exportDailyLibraryRecords({
        libraryId: library.id, bookFairId: bookFair.id, currency, date, from, to, exportType, signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `${label}-${library.name}-${bookFair.name}-${currency}-${date || `${from || 'all'}-${to || 'all'}`}.xlsx`.replace(/[\\/:*?"<>|]/g, '-')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      onNotice({ tone: 'success', message: `تم تصدير ${label} إلى Excel.` })
    } catch (error) {
      if (error.name !== 'AbortError') onNotice({ tone: 'error', message: libraryAccountError(error, 'تعذر تصدير حساب المكتبة. حاول تاني.') })
    } finally {
      pending.current = null
      setExporting(false)
    }
  }

  return <button className="button button--primary" type="button" onClick={handleExport} disabled={!canExport || exporting || !isActive}>
    {exporting ? <span className="spinner" /> : <Icon name="download" size={18} />}
    {exporting ? 'جاري التصدير…' : `تصدير ${label} إلى Excel`}
  </button>
}

export function LibraryDailyExport({ library, currency, localCurrency, mode, onModeChange, date, onDateChange, from, to, onFromChange, onToChange }) {
  return <section className="panel library-daily-export" aria-label="فترة سجلات المكتبة">
    <div><h2>سجلات المكتبة</h2><p>{library.name} · {getCurrencyName(currency, localCurrency)}. الاختيار يطبق على التبويبات وملفات Excel الثلاثة.</p></div>
    <div className="library-period-filter">
      <div className="library-period-options" role="group" aria-label="تحديد فترة الحركات">{[['all', 'كل الحركات'], ['day', 'يوم محدد'], ['range', 'فترة']].map(([value, label]) => <button className={`button ${mode === value ? 'button--primary' : 'button--secondary'}`} type="button" key={value} aria-pressed={mode === value} onClick={() => onModeChange(value)}>{label}</button>)}</div>
      {mode === 'day' && <label className="form-field"><span>التاريخ</span><input type="date" name="library-transactions-date" dir="ltr" required value={date} onChange={(event) => onDateChange(event.target.value)} /></label>}
      {mode === 'range' && <div className="library-period-dates"><label className="form-field"><span>من تاريخ</span><input type="date" name="library-from" dir="ltr" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} /></label><label className="form-field"><span>إلى تاريخ</span><input type="date" name="library-to" dir="ltr" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} /></label></div>}
    </div>
  </section>
}
