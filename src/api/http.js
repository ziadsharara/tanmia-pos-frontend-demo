import { demoRequest, DemoError, exportDemoReport } from '../demo/store.js'
import { previewDemoWorkbook } from '../demo/workbook.js'

export const ApiError = DemoError

export async function request(path, { method = 'GET', body, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return demoRequest(path, { method, body, signal })
}

export async function postMultipart(path, file, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (path !== '/books/imports/preview') throw new DemoError('العملية غير متاحة في نسخة العرض', 404)
  const preview = await previewDemoWorkbook(file)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return { status: true, message: 'تمت معاينة الملف', data: preview }
}

export async function requestFile(path, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return exportDemoReport(path)
}
