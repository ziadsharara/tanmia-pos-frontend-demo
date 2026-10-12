import { useRef } from 'react'
import { Icon } from '../ui/Icon.jsx'

function formatFileSize(size) {
  if (size < 1024) return `${size} بايت`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} كيلوبايت`
  return `${(size / (1024 * 1024)).toFixed(1)} ميجابايت`
}

export function FilePicker({ file, disabled, onSelect, onClear }) {
  const inputRef = useRef(null)

  const selectFile = (event) => {
    onSelect(event.target.files?.[0] || null)
    event.target.value = ''
  }

  return (
    <div className={`file-picker ${file ? 'file-picker--selected' : ''}`}>
      <input ref={inputRef} className="visually-hidden" name="books-file" aria-label="ملف Excel للكتب" type="file" accept=".xlsx,.xls" onChange={selectFile} disabled={disabled} />
      <div className="file-picker__icon"><Icon name="file" size={26} /></div>
      <div className="file-picker__copy">
        <strong>{file ? file.name : 'اختار ملف Excel'}</strong>
      </div>
      <div className="file-picker__actions">
        {file && <button className="button button--file-delete" type="button" disabled={disabled} onClick={onClear}><Icon name="trash" size={17} />حذف الملف</button>}
        <button className="button button--secondary" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={18} />{file ? 'اختيار ملف تاني' : 'اختيار الملف'}
        </button>
      </div>
    </div>
  )
}
