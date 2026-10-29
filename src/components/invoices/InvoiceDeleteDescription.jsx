export function InvoiceDeleteDescription({ invoice }) {
  const libraryInvoice = invoice.paymentType === 'WHOLESALE_CREDIT'
  const returned = invoice.paymentStatus === 'REFUND'
  return <div className="invoice-delete-description">
    <div className="invoice-delete-description__number"><span>رقم الفاتورة</span><bdi dir="ltr">{invoice.invoiceNumber}</bdi></div>
    <ul>
      <li>{libraryInvoice ? 'هنلغي أثر الفاتورة على رصيد المكتبة، وهتختفي من قائمة الفواتير.' : 'هنحذف الفاتورة وبنودها من البرنامج نهائياً، ومش هتقدر تسترجعها.'}</li>
      <li>{returned ? 'الكتب رجعت للمخزون مع المرتجع، فمش هنضيفها مرة تانية.' : 'كميات الكتب الموجودة في الفاتورة هترجع للمخزون.'}</li>
      {libraryInvoice && <><li>أي دفعات سابقة هتفضل محفوظة. لو المدفوع بقى أكبر من المديونية، الفرق هيظهر رصيد لصالح المكتبة.</li><li>هنحتفظ بالفاتورة كمرجع في كشف الحساب، مع تسجيل حركة إلغاء.</li></>}
      {!libraryInvoice && invoice.paymentType === 'DIRECT' && <li>الحذف مش بيسجل رد فلوس للعميل. لو رجّعت له فلوس، استخدم «المرتجعات» قبل حذف الفاتورة.</li>}
    </ul>
  </div>
}
