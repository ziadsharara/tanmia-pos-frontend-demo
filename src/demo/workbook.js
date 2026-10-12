import { DemoError } from './store.js'
import { rebuildImportPreview } from '../utils/importPreview.js'

const required = ['الكود', 'الكتاب', 'المؤلف', 'العدد', 'السعر', 'السعر بالدولار']
const normalize = (value) => String(value ?? '').replace(/[\u200e\u200f\u061c]/g, '').replace(/\u00a0/g, ' ').trim()

export async function previewDemoWorkbook(file) {
  if (!file || !/\.xlsx?$/i.test(file.name)) throw new DemoError('اختار ملف Excel بصيغة xlsx أو xls')
  const XLSX = await import('xlsx')
  let workbook
  try { workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false }) }
  catch { throw new DemoError('تعذر قراءة ملف Excel') }
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new DemoError('ملف Excel لا يحتوي على شيت')
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: true })
  const headers = (grid[0] || []).map(normalize)
  for (const heading of required) {
    if (!headers.includes(heading)) throw new DemoError(`عمود مطلوب غير موجود: ${heading}`)
    if (headers.indexOf(heading) !== headers.lastIndexOf(heading)) throw new DemoError(`عنوان مكرر: ${heading}`)
  }
  for (let row = 1; row < grid.length; row += 1) {
    for (const heading of required) {
      const address = XLSX.utils.encode_cell({ r: row, c: headers.indexOf(heading) })
      if (sheet[address]?.f) throw new DemoError(`المعادلات غير مسموحة في الصف ${row + 1}، عمود ${heading}`)
    }
  }
  const column = (row, heading) => normalize(row[headers.indexOf(heading)])
  const rows = grid.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    code: column(row, 'الكود'), name: column(row, 'الكتاب'), author: column(row, 'المؤلف'),
    quantity: column(row, 'العدد'), price: column(row, 'السعر'), priceInUSD: column(row, 'السعر بالدولار'),
  })).filter((row) => [row.code, row.name, row.author, row.quantity, row.price, row.priceInUSD].some(Boolean))
  return rebuildImportPreview(rows)
}
