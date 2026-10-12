import { useEffect, useState } from 'react'
import { fetchInvoiceById } from '../api/invoices.js'
import { prepareInvoiceDetails } from '../utils/invoiceDetails.js'

export function useInvoiceDetails(bookFairId) {
  const [detail, setDetail] = useState({ status: 'idle', invoice: null })

  useEffect(() => {
    setDetail({ status: 'idle', invoice: null })
  }, [bookFairId])

  const openInvoice = async (invoiceId) => {
    if (!bookFairId) return null
    setDetail({ status: 'loading', invoice: null })
    try {
      const response = await fetchInvoiceById(invoiceId, bookFairId)
      setDetail({ status: 'ready', invoice: prepareInvoiceDetails(response.data) })
      return null
    } catch (error) {
      setDetail({ status: 'idle', invoice: null })
      return error
    }
  }

  const closeInvoice = () => setDetail({ status: 'idle', invoice: null })

  return { detail, openInvoice, closeInvoice }
}
