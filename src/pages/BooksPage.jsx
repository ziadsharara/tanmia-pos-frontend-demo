import { useCallback, useEffect, useRef, useState } from 'react'
import {
  confirmBooksImport,
  createBook,
  deleteAllBooks,
  deleteBook,
  fetchBookById,
  fetchBooks,
  previewBooksImport,
  updateBook,
} from '../api/books.js'
import { ApiError } from '../api/http.js'
import { BookCatalog } from '../components/books/BookCatalog.jsx'
import { BookFormModal } from '../components/books/BookFormModal.jsx'
import { DeleteBooksConfirmModal } from '../components/books/DeleteBooksConfirmModal.jsx'
import { FilePicker } from '../components/import/FilePicker.jsx'
import { ImportSummary } from '../components/import/ImportSummary.jsx'
import { ImportRowEditModal } from '../components/import/ImportRowEditModal.jsx'
import { PreviewTable } from '../components/import/PreviewTable.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { rebuildImportPreview } from '../utils/importPreview.js'
import { toArabicToastMessage } from '../utils/messages.js'

const initialImportState = { kind: 'idle', message: '', preview: null, imported: 0 }
const emptyBook = { code: '', name: '', author: '', quantity: '', price: '', priceInUSD: '' }
const closedEditor = { open: false, mode: 'add', bookId: null, status: 'ready', values: emptyBook, error: '' }

function getImportErrorState(error) {
  const preview = error instanceof ApiError ? error.response?.data || null : null
  return { kind: 'error', message: error instanceof Error ? error.message : 'حصل خطأ غير متوقع.', preview, imported: 0 }
}

function valuesFromBook(book) {
  return {
    code: book.code ?? '',
    name: book.name ?? '',
    author: book.author ?? '',
    quantity: String(book.quantity ?? ''),
    price: String(book.price ?? ''),
    priceInUSD: String(book.priceInUSD ?? ''),
  }
}

function requestFromValues(values) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    author: values.author.trim(),
    quantity: Number(values.quantity),
    price: values.price,
    priceInUSD: values.priceInUSD,
  }
}

export function BooksPage({ isActive, localCurrency, activeBookFair, dataVersion, onDataChanged }) {
  const [file, setFile] = useState(null)
  const [importState, setImportState] = useState(initialImportState)
  const [importRowEditor, setImportRowEditor] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [catalogState, setCatalogState] = useState({ status: 'loading', data: null, error: '' })
  const [toast, setToast] = useState(null)
  const [deletionState, setDeletionState] = useState({ bookId: null, all: false })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editor, setEditor] = useState(closedEditor)
  const editorRequestRef = useRef(0)
  const previewRequestRef = useRef(0)
  const previewControllerRef = useRef(null)
  const toastIdRef = useRef(0)
  const importBusy = importState.kind === 'previewing' || importState.kind === 'importing'

  const showToast = (tone, message) => {
    if (!message) return
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, tone, message })
  }

  const closeToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(0)
      setDebouncedSearch(searchInput.trim())
    }, 180)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  useEffect(() => {
    if (!isActive) return undefined
    if (!activeBookFair?.id) {
      setCatalogState({ status: 'idle', data: null, error: '' })
      return undefined
    }
    const controller = new AbortController()
    let active = true
    setCatalogState((current) => ({ status: 'loading', data: current.data, error: '' }))

    fetchBooks({ bookFairId: activeBookFair.id, search: debouncedSearch, page, size: 7, signal: controller.signal })
      .then((response) => {
        if (active) setCatalogState({ status: 'ready', data: response.data, error: '' })
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError') {
          setCatalogState((current) => ({ status: 'error', data: current.data, error: error.message }))
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [isActive, activeBookFair?.id, debouncedSearch, page, refreshKey, dataVersion])

  useEffect(() => {
    previewControllerRef.current?.abort()
    previewRequestRef.current += 1
    editorRequestRef.current += 1
    setFile(null)
    setImportState(initialImportState)
    setImportRowEditor(null)
    setSearchInput('')
    setDebouncedSearch('')
    setPage(0)
    setDeleteTarget(null)
    setEditor(closedEditor)
  }, [activeBookFair?.id])

  const refreshCatalog = () => setRefreshKey((value) => value + 1)

  const handleFileSelect = async (selectedFile) => {
    if (!activeBookFair) return
    previewControllerRef.current?.abort()
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    setFile(selectedFile)
    setImportState(initialImportState)
    setImportRowEditor(null)
    if (!selectedFile) return

    const controller = new AbortController()
    previewControllerRef.current = controller
    setImportState({ ...initialImportState, kind: 'previewing' })
    try {
      const response = await previewBooksImport(selectedFile, { signal: controller.signal })
      if (previewRequestRef.current === requestId) {
        setImportState({ kind: 'previewed', message: response.message, preview: response.data, imported: 0 })
        showToast('success', 'تمت معاينة ملف Excel بنجاح')
      }
    } catch (error) {
      if (previewRequestRef.current === requestId && error.name !== 'AbortError') {
        setImportState(getImportErrorState(error))
        showToast('error', toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذرت معاينة ملف Excel. راجع الملف وحاول تاني.'))
      }
    }
  }

  const clearImportSelection = () => {
    previewControllerRef.current?.abort()
    previewRequestRef.current += 1
    setFile(null)
    setImportState(initialImportState)
    setImportRowEditor(null)
  }

  const deletePreviewRow = (rowNumber) => {
    setImportState((current) => ({
      ...current,
      kind: 'previewed',
      preview: rebuildImportPreview(current.preview.rows.filter((row) => row.rowNumber !== rowNumber)),
    }))
  }

  const changePreviewRow = (field, value) => {
    setImportRowEditor((current) => ({ ...current, [field]: value }))
  }

  const savePreviewRow = () => {
    setImportState((current) => ({
      ...current,
      kind: 'previewed',
      preview: rebuildImportPreview(current.preview.rows.map((row) => row.rowNumber === importRowEditor.rowNumber ? importRowEditor : row)),
    }))
    setImportRowEditor(null)
  }

  const handleImport = async () => {
    if (!file || importBusy || !importState.preview?.valid || !importState.preview.readyToImport) return
    setImportState((current) => ({ ...current, kind: 'importing', message: '' }))
    try {
      const response = await confirmBooksImport(importState.preview.rows, activeBookFair.id)
      setImportState({ kind: 'success', message: response.message, preview: null, imported: response.data?.imported || 0 })
      setFile(null)
      showToast('success', `تم استيراد ${response.data?.imported || 0} كتاب بنجاح`)
      onDataChanged()
    } catch (error) {
      setImportState(getImportErrorState(error))
      showToast('error', toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر استيراد ملف Excel. راجع الملف وحاول تاني.'))
    }
  }

  const openAddBook = () => {
    editorRequestRef.current += 1
    setEditor({ ...closedEditor, open: true, values: { ...emptyBook } })
  }

  const openEditBook = async (bookId) => {
    const requestId = editorRequestRef.current + 1
    editorRequestRef.current = requestId
    setEditor({ open: true, mode: 'edit', bookId, status: 'loading', values: { ...emptyBook }, error: '' })
    try {
      const response = await fetchBookById(bookId, activeBookFair.id)
      if (editorRequestRef.current === requestId) {
        setEditor({ open: true, mode: 'edit', bookId, status: 'ready', values: valuesFromBook(response.data), error: '' })
      }
    } catch (error) {
      if (editorRequestRef.current === requestId) {
        setEditor((current) => ({ ...current, status: 'load-error', error: error.message }))
      }
    }
  }

  const closeEditor = () => {
    editorRequestRef.current += 1
    setEditor(closedEditor)
  }

  const changeEditorField = (name, value) => {
    setEditor((current) => ({ ...current, values: { ...current.values, [name]: value }, error: '' }))
  }

  const submitBook = async (event) => {
    event.preventDefault()
    if (editor.status === 'submitting') return
    setEditor((current) => ({ ...current, status: 'submitting', error: '' }))
    try {
      const payload = requestFromValues(editor.values)
      if (editor.mode === 'edit') {
        await updateBook(editor.bookId, activeBookFair.id, payload)
      } else {
        await createBook(payload, activeBookFair.id)
      }
      showToast('success', editor.mode === 'edit' ? 'تم تعديل الكتاب بنجاح' : 'تمت إضافة الكتاب بنجاح')
      closeEditor()
      onDataChanged()
    } catch (error) {
      setEditor((current) => ({ ...current, status: 'ready', error: '' }))
      showToast('error', toArabicToastMessage(error instanceof Error ? error.message : '', editor.mode === 'edit' ? 'تعذر تعديل الكتاب. حاول تاني.' : 'تعذرت إضافة الكتاب. حاول تاني.'))
    }
  }

  const handleDeleteBook = async (bookId) => {
    if (deletionState.bookId !== null || deletionState.all) return
    setDeletionState({ bookId, all: false })
    try {
      const response = await deleteBook(bookId, activeBookFair.id)
      showToast('success', toArabicToastMessage(response.message, 'تم حذف الكتاب بنجاح'))
      onDataChanged()
    } catch (error) {
      showToast('error', toArabicToastMessage(error instanceof Error ? error.message : '', 'الكتاب ماتحذفش. حاول تاني.'))
    } finally {
      setDeletionState({ bookId: null, all: false })
    }
  }

  const handleDeleteAllBooks = async () => {
    if (deletionState.bookId !== null || deletionState.all) return
    setDeletionState({ bookId: null, all: true })
    try {
      const response = await deleteAllBooks(activeBookFair.id)
      showToast('success', toArabicToastMessage(response.message, 'تم حذف كل كتب المعرض بنجاح'))
      setPage(0)
      onDataChanged()
    } catch (error) {
      showToast('error', toArabicToastMessage(error instanceof Error ? error.message : '', 'الكتب ماتحذفتش. حاول تاني.'))
    } finally {
      setDeletionState({ bookId: null, all: false })
    }
  }

  const confirmDeletion = async () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'all') {
      await handleDeleteAllBooks()
    } else {
      await handleDeleteBook(deleteTarget.book.id)
    }
    setDeleteTarget(null)
  }

  const canImport = importState.kind === 'previewed' && importState.preview?.valid && importState.preview.readyToImport > 0

  if (!activeBookFair) {
    return (
      <div className="page" id="books">
        <section className="page-heading">
          <div><h1>الكتب</h1><p>كل معرض له قائمة كتب وأرصدة مستقلة.</p></div>
          <div className="page-heading__actions"><button className="button button--primary" type="button" disabled><Icon name="add" size={19} />إضافة كتاب</button><div className="page-heading__icon"><Icon name="books" size={28} /></div></div>
        </section>
        <Notice tone="info" title="اختار معرض أولاً">افتح إعدادات المعرض، اختار معرض محفوظ أو أنشئ معرض جديد، وبعدها تقدر تضيف أو تستورد كتبه.</Notice>
        <a className="button button--primary empty-state-action" href="#settings"><Icon name="settings" size={18} />فتح إعدادات المعرض</a>
      </div>
    )
  }

  return (
    <div className="page" id="books">
      <section className="page-heading">
        <div><h1>الكتب</h1><p>كتب وأرصدة {activeBookFair.name} فقط.</p></div>
        <div className="page-heading__actions"><button className="button button--primary" type="button" onClick={openAddBook}><Icon name="add" size={19} />إضافة كتاب</button><div className="page-heading__icon"><Icon name="books" size={28} /></div></div>
      </section>

      <BookCatalog search={searchInput} onSearchChange={setSearchInput} state={catalogState} page={page} onPageChange={setPage} onRetry={refreshCatalog} onEdit={openEditBook} onDelete={(book) => setDeleteTarget({ kind: 'single', book })} onDeleteAll={() => setDeleteTarget({ kind: 'all' })} deletingBookId={deletionState.bookId} isDeletingAll={deletionState.all} localCurrency={localCurrency} />

      <details className="panel import-panel">
        <summary className="import-panel__summary">
          <span className="import-panel__summary-icon"><Icon name="upload" size={19} /></span>
          <span><strong>استيراد كتب من Excel</strong><small>مسار ثانوي لإضافة مجموعة كتب بعد معاينتها ومراجعتها.</small></span>
          <span className="import-panel__chevron" aria-hidden="true"><Icon name="previous" size={17} /></span>
        </summary>
        <div className="import-panel__content">
          <FilePicker file={file} disabled={importState.kind === 'importing'} onSelect={handleFileSelect} onClear={clearImportSelection} />
          <div className="actions-row">
            {importState.kind === 'previewing' && <span className="import-loading"><span className="spinner" />جاري قراءة الملف...</span>}
            <span className="actions-row__hint">اختيار الملف بيعرض المعاينة تلقائياً من غير إضافة أي بيانات.</span>
          </div>
          {importState.preview && (
            <div className="preview-section">
              <div className="preview-section__heading"><div><span className="eyebrow">نتيجة المعاينة</span><h3>{importState.preview.valid ? 'الملف جاهز للاستيراد' : 'راجع المشاكل قبل الاستيراد'}</h3></div><span className={`status-pill ${importState.preview.valid ? 'status-pill--success' : 'status-pill--error'}`}>{importState.preview.valid ? 'سليم' : 'فيه أخطاء'}</span></div>
              <ImportSummary preview={importState.preview} />
              <PreviewTable preview={importState.preview} localCurrency={localCurrency} onEditRow={(row) => setImportRowEditor({ ...row })} onDeleteRow={deletePreviewRow} />
              <div className="confirmation-bar"><div><strong>راجع البيانات كويس قبل الحفظ</strong><span>الاستيراد بيضيف الصفوف الجاهزة الموجودة في المعاينة بعد الحذف أو التعديل.</span></div><div className="confirmation-bar__actions"><button className="button button--ghost" type="button" disabled={importBusy} onClick={clearImportSelection}>إلغاء المعاينة</button><button className="button button--primary" type="button" disabled={!canImport || importBusy} onClick={handleImport}>{importState.kind === 'importing' ? <span className="spinner spinner--light" /> : <Icon name="upload" size={18} />}{importState.kind === 'importing' ? 'جاري الاستيراد...' : `تأكيد استيراد ${importState.preview.readyToImport} كتاب`}</button></div></div>
            </div>
          )}
        </div>
      </details>
      <BookFormModal editor={editor} onChange={changeEditorField} onClose={closeEditor} onSubmit={submitBook} onRetry={() => openEditBook(editor.bookId)} localCurrency={localCurrency} />
      <ImportRowEditModal row={importRowEditor} localCurrency={localCurrency} onChange={changePreviewRow} onClose={() => setImportRowEditor(null)} onSave={savePreviewRow} />
      {deleteTarget && <DeleteBooksConfirmModal target={deleteTarget} isBusy={deletionState.bookId !== null || deletionState.all} onClose={() => setDeleteTarget(null)} onConfirm={confirmDeletion} />}
      {toast && <Toast key={toast.id} tone={toast.tone} message={toast.message} onClose={closeToast} />}
    </div>
  )
}
