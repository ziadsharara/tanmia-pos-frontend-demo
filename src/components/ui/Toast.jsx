import { useEffect } from 'react'
import { Icon } from './Icon.jsx'
import { toArabicToastMessage } from '../../utils/messages.js'

export function Toast({ tone = 'success', message, duration = 3500, onClose }) {
  const displayedMessage = toArabicToastMessage(
    message,
    tone === 'error' ? 'تعذر تنفيذ الطلب. حاول تاني.' : 'تم تنفيذ الطلب بنجاح',
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timeoutId)
  }, [duration, onClose])

  return (
    <div className={`toast toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={21} />
      <strong>{displayedMessage}</strong>
      <button className="toast__close" type="button" aria-label="إغلاق الرسالة" onClick={onClose}><Icon name="close" size={17} /></button>
    </div>
  )
}
