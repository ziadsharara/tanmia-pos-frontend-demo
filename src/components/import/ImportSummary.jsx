import { Icon } from '../ui/Icon.jsx'

export function ImportSummary({ preview }) {
  const errorRows = new Set(preview.errors.map((error) => error.rowNumber)).size

  return (
    <div className="summary-grid" aria-label="ملخص المعاينة">
      <div className="summary-card"><span>إجمالي الصفوف</span><strong>{preview.totalRows}</strong></div>
      <div className="summary-card summary-card--success"><span><Icon name="check" size={16} />جاهزة للاستيراد</span><strong>{preview.readyToImport}</strong></div>
      <div className={`summary-card ${errorRows ? 'summary-card--error' : ''}`}><span><Icon name={errorRows ? 'alert' : 'check'} size={16} />صفوف فيها مشاكل</span><strong>{errorRows}</strong></div>
    </div>
  )
}
