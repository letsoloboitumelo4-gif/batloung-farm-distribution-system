import { useState } from 'react'

const provinces = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West']
const configs = {
  supplier: [
    ['business_name', 'Business name', 'text', true], ['contact_person', 'Contact person', 'text', true],
    ['phone', 'Phone number', 'text', true], ['province', 'Province', 'province', true], ['address', 'Address', 'textarea', false],
  ],
  vendor: [
    ['vendor_name', 'Vendor name', 'text', true], ['phone_number', 'Phone number', 'text', true],
    ['location', 'Location', 'text', false], ['registration_date', 'Registration date', 'date', true],
  ],
  fruit: [
    ['fruit_name', 'Fruit name', 'text', true], ['description', 'Description', 'textarea', false],
    ['small_price', 'Small price', 'number', true], ['medium_price', 'Medium price', 'number', true],
    ['large_price', 'Large price', 'number', true], ['status', 'Status', 'status', true],
  ],
}

export default function RecordEditor({ editor, onClose, onSave }) {
  const { type, record } = editor
  const fields = configs[type]
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(([key]) => [key, record[key] ?? ''])))
  const title = { supplier: 'Edit supplier', vendor: 'Edit vendor', fruit: 'Edit fruit' }[type]
  const id = record[`${type}_id`]
  const endpoint = type === 'fruit' ? 'fruits' : `${type}s`

  function update(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const payload = { ...values }
    if (type === 'fruit') {
      for (const key of ['small_price', 'medium_price', 'large_price']) payload[key] = Number(payload[key])
    }
    if (await onSave(`/${endpoint}/${id}`, payload)) onClose()
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div className="modal-heading"><div><span className="eyebrow">RECORD #{id}</span><h2 id="edit-title">{title}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={submit}>
        {fields.map(([key, label, kind, required]) => <label className="field" key={key}><span>{label}</span>
          {kind === 'province' ? <select value={values[key]} required={required} onChange={(event) => update(key, event.target.value)}>{provinces.map((province) => <option key={province}>{province}</option>)}</select>
            : kind === 'status' ? <select value={values[key]} required={required} onChange={(event) => update(key, event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select>
              : kind === 'textarea' ? <textarea rows="3" value={values[key]} required={required} onChange={(event) => update(key, event.target.value)} />
                : <input type={kind} min={kind === 'number' ? '0' : undefined} step={kind === 'number' ? '0.01' : undefined} value={values[key]} required={required} onChange={(event) => update(key, event.target.value)} />}
        </label>)}
        <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-primary">Save changes</button></div>
      </form>
    </section>
  </div>
}
