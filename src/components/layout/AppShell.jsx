import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'
import tanmiaLogo from '../../assets/brand/tanmia-logo.png'

const navigation = [
  { page: 'new-invoice', label: 'فاتورة جديدة', icon: 'invoice' },
  { page: 'invoices', label: 'الفواتير', icon: 'history' },
  { page: 'returns', label: 'المرتجعات', icon: 'refund' },
  { page: 'books', label: 'الكتب', icon: 'books' },
]

export function AppShell({ activePage, exhibitionName, localCurrency, onNavigate, children }) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const mobileMoreTriggerRef = useRef(null)
  const mobileMoreRef = useDialogA11y(mobileMoreOpen, () => setMobileMoreOpen(false))
  const reportsActive = activePage.startsWith('reports-')

  const navigate = (event, page) => {
    event.preventDefault()
    onNavigate(page)
  }

  const navigateFromMobileMenu = (event, page) => {
    setMobileMoreOpen(false)
    navigate(event, page)
  }

  const closeMobileMore = () => {
    setMobileMoreOpen(false)
    window.requestAnimationFrame(() => mobileMoreTriggerRef.current?.focus())
  }

  useEffect(() => {
    setMobileMoreOpen(false)
  }, [activePage])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <aside className="sidebar">
        <div>
          <div className="brand">
            <span className="brand__mark"><img src={tanmiaLogo} alt="شعار تنمية" width="56" height="56" fetchPriority="high" /></span>
            <span className="brand__copy"><strong>دار تنمية للنشر والتوزيع</strong><small>نظام المعارض | نقطة البيع</small></span>
          </div>
          <nav className="nav" aria-label="القائمة الرئيسية">
            {navigation.map((item) => (
              <a key={item.page} href={`#${item.page}`} onClick={(event) => navigate(event, item.page)} className={`nav__item ${activePage === item.page ? 'nav__item--active' : ''}`} aria-current={activePage === item.page ? 'page' : undefined}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </a>
            ))}
            <a href="#reports-dashboard" onClick={(event) => navigate(event, 'reports-dashboard')} className={`nav__item nav__desktop-destination ${reportsActive ? 'nav__item--active' : ''}`} aria-current={reportsActive ? 'page' : undefined}>
              <Icon name="reports" />
              <span>التقارير</span>
            </a>
            <a href="#settings" onClick={(event) => navigate(event, 'settings')} className={`nav__item nav__desktop-destination ${activePage === 'settings' ? 'nav__item--active' : ''}`} aria-current={activePage === 'settings' ? 'page' : undefined}>
              <Icon name="settings" />
              <span>إعدادات المعرض</span>
            </a>
            <button ref={mobileMoreTriggerRef} className={`nav__item nav__more-trigger ${reportsActive || activePage === 'settings' ? 'nav__item--active' : ''}`} type="button" aria-expanded={mobileMoreOpen} aria-controls="mobile-more-menu" onClick={() => setMobileMoreOpen((current) => !current)}>
              <Icon name="menu" />
              <span>المزيد</span>
            </button>
          </nav>
        </div>
        <div className="sidebar__bottom">
          <a className="sidebar__context" href="#settings" onClick={(event) => navigate(event, 'settings')}>
            <span>المعرض النشط</span>
            <strong>{exhibitionName || 'لم يتم اختيار معرض'}</strong>
            <small>{localCurrency?.nameAr || 'افتح الإعدادات للاختيار'}</small>
          </a>
          <div className="sidebar__footer"><span>نقطة البيع</span><span>دار تنمية</span></div>
        </div>

        {mobileMoreOpen && <>
          <button className="mobile-more__backdrop" type="button" aria-label="إغلاق قائمة المزيد" onClick={closeMobileMore} />
          <section ref={mobileMoreRef} className="mobile-more" id="mobile-more-menu" role="dialog" aria-modal="true" aria-label="التقارير والإعدادات" tabIndex="-1">
            <header className="mobile-more__header"><div><span>المعرض النشط</span><strong>{exhibitionName || 'لم يتم اختيار معرض'}</strong></div><button className="icon-button" type="button" aria-label="إغلاق" autoFocus onClick={closeMobileMore}><Icon name="close" /></button></header>
            <a className={`mobile-more__settings ${reportsActive ? 'is-active' : ''}`} href="#reports-dashboard" onClick={(event) => navigateFromMobileMenu(event, 'reports-dashboard')} aria-current={reportsActive ? 'page' : undefined}><Icon name="reports" size={18} />التقارير</a>
            <a className={`mobile-more__settings ${activePage === 'settings' ? 'is-active' : ''}`} href="#settings" onClick={(event) => navigateFromMobileMenu(event, 'settings')} aria-current={activePage === 'settings' ? 'page' : undefined}><Icon name="settings" size={18} />إعدادات المعرض</a>
          </section>
        </>}
      </aside>

      <div className="workspace">
        <main className="main-content" id="main-content" tabIndex="-1">{children}</main>
      </div>
    </div>
  )
}
