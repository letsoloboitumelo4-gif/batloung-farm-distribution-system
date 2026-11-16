const labels = {
  supplier_id: 'Supplier ID', business_name: 'Business name', contact_person: 'Contact person',
  phone: 'Phone', province: 'Province', address: 'Address',
  fruit_id: 'Fruit ID', fruit_name: 'Fruit name', description: 'Description', status: 'Status',
  small_price: 'Small price', medium_price: 'Medium price', large_price: 'Large price',
  vendor_id: 'Vendor ID', vendor_name: 'Vendor name', phone_number: 'Phone number',
  location: 'Location', registration_date: 'Registration date',
}

const currencyFields = new Set(['small_price', 'medium_price', 'large_price'])

function displayValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'status') return value === 'active' ? 'Available' : 'Inactive'
  if (currencyFields.has(key)) {
    return `M ${Number(value).toLocaleString('en-LS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return value
}

export default function RecordViewer({ viewer, onClose }) {
  const { type, record } = viewer
  const title = { supplier: 'Supplier details', fruit: 'Fruit details', vendor: 'Vendor details' }[type]
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="edit-modal view-modal" role="dialog" aria-modal="true" aria-labelledby="view-title">
      <div className="modal-heading"><div><span className="eyebrow">RECORD DETAILS</span><h2 id="view-title">{title}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
      <dl className="record-details">{Object.entries(record).map(([key, value]) => <div className="detail-row" key={key}><dt>{labels[key] || key.replaceAll('_', ' ')}</dt><dd>{displayValue(key, value)}</dd></div>)}</dl>
      <div className="modal-actions"><button type="button" className="button button-primary" onClick={onClose}>Done</button></div>
    </section>
  </div>
}
