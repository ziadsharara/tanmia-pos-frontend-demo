import { useEffect, useState } from 'react'
import { createBookFair, deleteBookFair, fetchAllCountries, fetchCurrencies } from '../api/bookFairs.js'
import { getCurrencyDetails, translateCountry } from '../data/bookFairs.js'
import { Icon } from '../components/ui/Icon.jsx'
import { AppDropdown } from '../components/ui/AppDropdown.jsx'
import { DeleteDataConfirmModal } from '../components/ui/DeleteDataConfirmModal.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { toArabicToastMessage } from '../utils/messages.js'

const emptyValues = { name: '', country: '' }

export function ExhibitionSettingsPage({ isActive, bookFairs, activeBookFair, bookFairsState, onSelectBookFair, onBookFairCreated, onBookFairDeleted }) {
  const [values, setValues] = useState(emptyValues)
  const [countriesState, setCountriesState] = useState({ status: 'loading', countries: [], error: '' })
  const [currencyState, setCurrencyState] = useState({ status: 'idle', currency: null, error: '' })
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isActive) return undefined
    const controller = new AbortController()
    fetchAllCountries({ signal: controller.signal })
      .then((response) => setCountriesState({ status: 'ready', countries: response.data || [], error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setCountriesState({ status: 'error', countries: [], error: error.message })
      })
    return () => controller.abort()
  }, [isActive])

  useEffect(() => {
    if (!isActive) return undefined
    if (!values.country) {
      setCurrencyState({ status: 'idle', currency: null, error: '' })
      return undefined
    }
    const controller = new AbortController()
    setCurrencyState({ status: 'loading', currency: null, error: '' })
    fetchCurrencies(values.country, { signal: controller.signal })
      .then((response) => setCurrencyState({ status: 'ready', currency: response.data, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setCurrencyState({ status: 'error', currency: null, error: error.message })
      })
    return () => controller.abort()
  }, [isActive, values.country])

  const selectExistingFair = (bookFairId) => {
    const selected = bookFairs.find((bookFair) => bookFair.id === Number(bookFairId)) || null
    onSelectBookFair(selected)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (saving || !values.name.trim() || !values.country || currencyState.status !== 'ready') return
    setSaving(true)
    try {
      const response = await createBookFair({
        name: values.name.trim(),
        country: values.country,
        primaryCurrency: currencyState.currency.currencyCode,
        secondCurrency: 'USD',
      })
      onBookFairCreated(response.data)
      setValues(emptyValues)
      setToast({ tone: 'success', message: 'تم إنشاء المعرض واختياره بنجاح' })
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر إنشاء المعرض. حاول تاني.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBookFair = async () => {
    if (!activeBookFair?.id || deleting) return
    setDeleting(true)
    try {
      const deletedFair = activeBookFair
      const response = await deleteBookFair(deletedFair.id)
      onBookFairDeleted(deletedFair.id)
      setDeleteOpen(false)
      setToast({ tone: 'success', message: toArabicToastMessage(response.message, 'تم حذف المعرض وكل بياناته بنجاح') })
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر حذف المعرض. حاول تاني.') })
    } finally {
      setDeleting(false)
    }
  }

  const activeCurrency = activeBookFair ? getCurrencyDetails(activeBookFair.primaryCurrency) : null
  const canCreate = values.name.trim() && values.country && currencyState.status === 'ready' && !saving
  const bookFairOptions = bookFairs.map((bookFair) => ({ value: bookFair.id, label: bookFair.name }))
  const countryOptions = countriesState.countries.map((country) => ({ value: country, label: translateCountry(country) }))

  return (
    <div className="page settings-page">
      <section className="page-heading"><div><h1>إعدادات المعرض</h1><p>اختار معرض موجود أو أنشئ معرض جديد وحدد دولته وعملته.</p></div><div className="page-heading__icon"><Icon name="settings" size={28} /></div></section>

      <section className="panel settings-panel settings-panel--active">
        <div className="panel__heading"><div><h2>اختيار المعرض</h2></div></div>
        {bookFairsState.status === 'error' && <Notice tone="error" title="تعذر تحميل المعارض">{bookFairsState.error}</Notice>}
        <div className="settings-grid">
          <div className="form-field"><span>المعرض النشط</span><AppDropdown ariaLabel="المعرض النشط" options={bookFairOptions} placeholder="اختار معرض" value={activeBookFair?.id || ''} disabled={bookFairsState.status === 'loading' || bookFairs.length === 0} onChange={selectExistingFair} /></div>
        </div>
        {bookFairsState.status === 'loading' && <span className="import-loading settings-inline-state"><span className="spinner" />جاري تحميل المعارض...</span>}
        {bookFairsState.status === 'ready' && bookFairs.length === 0 && <Notice tone="info" title="مفيش معرض محفوظ">أنشئ أول معرض قبل إضافة أو استيراد الكتب.</Notice>}
        {activeBookFair && <><div className="active-fair-summary"><span><b>المعرض</b>{activeBookFair.name}</span><span><b>الدولة</b>{translateCountry(activeBookFair.country)}</span><span><b>العملة المحلية</b>{activeCurrency.nameAr} <small dir="ltr">({activeCurrency.code})</small></span><span><b>العملة الثانية</b>الدولار الأمريكي <small dir="ltr">(USD)</small></span></div><div className="settings-delete-action"><span>حذف المعرض هيمسح كتبه وفواتيره ومرتجعاته.</span><button className="button button--danger-soft" type="button" disabled={deleting} onClick={() => setDeleteOpen(true)}><Icon name="trash" size={18} />حذف المعرض</button></div></>}
      </section>

      <section className="panel settings-panel settings-panel--create">
        <div className="panel__heading"><div><h2>إنشاء معرض جديد</h2></div></div>
        <form onSubmit={submit}>
          <div className="settings-grid">
            <label className="form-field"><span>اسم المعرض</span><input name="exhibition-name" autoComplete="off" type="text" required disabled={saving} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} placeholder="مثال: معرض الشارقة الدولي للكتاب…" /></label>
            <div className="form-field"><span>الدولة</span><AppDropdown ariaLabel="الدولة" options={countryOptions} placeholder="اختار الدولة" disabled={saving || countriesState.status !== 'ready'} value={values.country} onChange={(country) => setValues((current) => ({ ...current, country }))} /></div>
          </div>

          {countriesState.status === 'loading' && <span className="import-loading settings-inline-state"><span className="spinner" />جاري تحميل الدول...</span>}
          {countriesState.status === 'error' && <Notice tone="error" title="تعذر تحميل الدول">{countriesState.error}</Notice>}
          {currencyState.status === 'error' && <Notice tone="error" title="تعذر تحميل عملة الدولة">{currencyState.error}</Notice>}

          <div className="currency-preview">
            <div><span>العملة المحلية</span>{currencyState.status === 'loading' ? <strong>جاري التحميل...</strong> : currencyState.currency ? <><strong>{currencyState.currency.currencyName}</strong><small dir="ltr">{currencyState.currency.currencyCode} · {currencyState.currency.currencySymbol}</small></> : <strong>اختار الدولة أولاً</strong>}</div>
            <div><span>العملة الثانية</span><strong>الدولار الأمريكي</strong><small dir="ltr">USD · $</small></div>
          </div>
          <div className="settings-actions"><span>بعد الإنشاء هيتم اختيار المعرض الجديد تلقائياً.</span><button className="button button--primary" type="submit" disabled={!canCreate}>{saving ? <span className="spinner spinner--light" /> : <Icon name="add" size={18} />}{saving ? 'جاري الإنشاء...' : 'إنشاء واختيار المعرض'}</button></div>
        </form>
      </section>
      {deleteOpen && activeBookFair && <DeleteDataConfirmModal title="حذف المعرض" description={`هيتم حذف ${activeBookFair.name} وكل كتبه وفواتيره ومرتجعاته نهائياً.`} phrase="حذف المعرض" confirmLabel="حذف المعرض نهائياً" isBusy={deleting} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteBookFair} />}
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
