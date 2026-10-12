function clean(value) {
  return String(value ?? '').trim()
}

export function rebuildImportPreview(rows) {
  const errors = []
  const firstRowByCode = new Map()

  rows.forEach((row) => {
    const code = clean(row.code)
    const name = clean(row.name)
    const author = clean(row.author)
    const quantity = clean(row.quantity).replaceAll(',', '')
    const price = clean(row.price).replaceAll(',', '')
    const priceInUSD = clean(row.priceInUSD).replaceAll(',', '')

    if (!code) {
      errors.push({ rowNumber: row.rowNumber, column: 'الكود', message: 'الكود مطلوب' })
    } else if (firstRowByCode.has(code)) {
      errors.push({ rowNumber: row.rowNumber, column: 'الكود', message: `الكود مكرر في الصف ${firstRowByCode.get(code)}` })
    } else {
      firstRowByCode.set(code, row.rowNumber)
    }

    if (!name) errors.push({ rowNumber: row.rowNumber, column: 'الكتاب', message: 'اسم الكتاب مطلوب' })
    if (!author) errors.push({ rowNumber: row.rowNumber, column: 'المؤلف', message: 'اسم المؤلف مطلوب' })

    if (!/^\d+$/.test(quantity)) {
      errors.push({ rowNumber: row.rowNumber, column: 'العدد', message: 'العدد يجب أن يكون عدداً صحيحاً غير سالب' })
    }
    if (!price || !Number.isFinite(Number(price))) {
      errors.push({ rowNumber: row.rowNumber, column: 'السعر المحلي', message: 'السعر المحلي غير صحيح' })
    }
    if (!priceInUSD || !Number.isFinite(Number(priceInUSD))) {
      errors.push({ rowNumber: row.rowNumber, column: 'السعر بالدولار', message: 'السعر بالدولار غير صحيح' })
    }
  })

  const invalidRows = new Set(errors.map((error) => error.rowNumber))
  return {
    valid: rows.length > 0 && errors.length === 0,
    totalRows: rows.length,
    readyToImport: rows.length - invalidRows.size,
    errors,
    rows,
  }
}
