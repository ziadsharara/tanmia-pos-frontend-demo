import { Icon } from './Icon.jsx'

export function Notice({ tone = 'info', title, children }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info'} />
      <div><strong>{title}</strong>{children && <p>{children}</p>}</div>
    </div>
  )
}
