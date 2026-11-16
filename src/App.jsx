import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import RecordEditor from './RecordEditor.jsx'
import RecordViewer from './RecordViewer.jsx'

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const sections = ['Dashboard', 'Suppliers', 'Fruits', 'Vendors', 'Purchases', 'Sales', 'Stock', 'Reports', 'Payments']
const icons = ['▦', '♧', '◉', '♙', '↓', '↗', '▤', '▥', '$']
const sizes = ['small', 'medium', 'large']
const provinces = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West']
const today = new Date().toISOString().slice(0, 10)
const currentYear = new Date().getFullYear()
const firstOfMonth = `${today.slice(0, 8)}01`

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`)
  return result
}

const currency = (amount) => `M ${Number(amount || 0).toLocaleString('en-LS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function Table({ columns, rows, empty = 'Records will appear here when available.' }) {
  if (!rows?.length) return <div className="empty-state"><span>▤</span><strong>No records yet</strong><p>{empty}</p></div>
  return <div className="table-wrap"><table><thead><tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row[columns[0]?.key] ?? index}>{columns.map((col) => <td key={col.key}>{col.render ? col.render(row) : row[col.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>
}

function Title({ eyebrow, title, description, action }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function App() {
  const [section, setSection] = useState('Dashboard')
  const [data, setData] = useState({ suppliers: [], fruits: [], vendors: [], purchases: [], sales: [], stock: [], balances: [] })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendorResults, setVendorResults] = useState(null)
  const [purchaseItems, setPurchaseItems] = useState([{ fruit_id: '', packaging_size: 'small', quantity: '', unit_cost: '' }])
  const [saleItems, setSaleItems] = useState([{ fruit_id: '', packaging_size: 'small', quantity: '' }])
  const [range, setRange] = useState({ start_date: firstOfMonth, end_date: today })
  const [reports, setReports] = useState({ topFruits: [], revenue: null, topVendor: null })
  const [editor, setEditor] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [formModal, setFormModal] = useState(false)
  const canCreate = ['Suppliers', 'Fruits', 'Vendors', 'Purchases', 'Sales', 'Payments'].includes(section)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const [suppliers, fruits, vendors, purchases, sales, stock, balances] = await Promise.all([
        api('/suppliers'), api('/fruits?status=all'), api('/vendors'), api('/purchases'),
        api('/sales'), api('/stock'), api('/reports/outstanding-balances'),
      ])
      setData({ suppliers, fruits, vendors, purchases, sales, stock, balances })
    } catch (error) {
      setNotice({ type: 'error', text: `${error.message}. Check that the backend and database are running.` })
    } finally { setBusy(false) }
  }, [])

  useEffect(() => {
    let active = true
    async function loadInitialData() {
      try {
        const [suppliers, fruits, vendors, purchases, sales, stock, balances] = await Promise.all([
          api('/suppliers'), api('/fruits?status=all'), api('/vendors'), api('/purchases'),
          api('/sales'), api('/stock'), api('/reports/outstanding-balances'),
        ])
        if (active) setData({ suppliers, fruits, vendors, purchases, sales, stock, balances })
      } catch (error) {
        if (active) setNotice({ type: 'error', text: `${error.message}. Check that the backend and database are running.` })
      }
    }
    void loadInitialData()
    return () => { active = false }
  }, [])

  const activeFruits = data.fruits.filter((fruit) => fruit.status === 'active')
  const revenueTotal = useMemo(() => data.sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0), [data.sales])
  const outstandingTotal = useMemo(() => data.balances.reduce((sum, vendor) => sum + Number(vendor.outstanding_balance || 0), 0), [data.balances])
  const lowStock = data.stock.filter((item) => Number(item.available_quantity) <= 10)
  const openSales = data.sales.filter((sale) => Number(sale.total_amount) > Number(sale.amount_paid))

  function showNotice(type, text) {
    setNotice({ type, text })
    window.setTimeout(() => setNotice(null), 4200)
  }

  async function save(path, method, body, message) {
    try {
      const result = await api(path, { method, body: JSON.stringify(body) })
      showNotice('success', result.message || message)
      await refresh()
      return true
    } catch (error) {
      showNotice('error', error.message)
      return false
    }
  }

  async function search(event) {
    event.preventDefault()
    try { setVendorResults(await api(`/vendors/search?q=${encodeURIComponent(vendorSearch)}`)) }
    catch (error) { showNotice('error', error.message) }
  }

  function openEditor(type, record) {
    setEditor({ type, record })
  }

  async function viewRecord(type, record) {
    const collection = type === 'fruit' ? 'fruits' : `${type}s`
    const id = record[`${type}_id`]
    try {
      const details = await api(`/${collection}/${id}`)
      setViewer({ type, record: details })
    } catch (error) {
      showNotice('error', error.message)
    }
  }

  async function deleteSupplier(supplier) {
    const confirmed = window.confirm(`Delete ${supplier.business_name}? Suppliers with recorded purchases cannot be deleted.`)
    if (!confirmed) return
    try {
      const result = await api(`/suppliers/${supplier.supplier_id}`, { method: 'DELETE' })
      showNotice('success', result.message)
      await refresh()
    } catch (error) {
      showNotice('error', error.message)
    }
  }

  async function deleteRecord(type, record) {
    const labels = { fruit: record.fruit_name, vendor: record.vendor_name }
    const label = labels[type]
    const warning = type === 'fruit'
      ? 'Existing stock or transaction history may prevent deletion; consider marking the fruit unavailable instead.'
      : 'Vendors with recorded sales cannot be deleted.'
    if (!window.confirm(`Delete ${label}? ${warning}`)) return
    try {
      const collection = type === 'fruit' ? 'fruits' : 'vendors'
      const id = record[`${type}_id`]
      const result = await api(`/${collection}/${id}`, { method: 'DELETE' })
      showNotice('success', result.message)
      await refresh()
    } catch (error) {
      showNotice('error', error.message)
    }
  }

  const runReports = useCallback(async () => {
    try {
      const [topFruits, revenue, topVendor] = await Promise.all([
        api('/reports/top-fruits'),
        api(`/reports/sales-revenue?start_date=${range.start_date}&end_date=${range.end_date}`),
        api('/reports/top-vendor'),
      ])
      setReports({ topFruits, revenue, topVendor })
    } catch (error) { showNotice('error', error.message) }
  }, [range])

  const closeForm = () => setFormModal(false)
  function navigateToSection(nextSection) {
    setSection(nextSection)
    closeForm()
    if (nextSection === 'Reports') void runReports()
  }

  function renderDashboard() {
    const stats = [
      ['Suppliers', data.suppliers.length, 'Sourcing partners', '♧', 'green'],
      ['Vendors', data.vendors.length, 'Registered customers', '♙', 'blue'],
      ['Fruit varieties', activeFruits.length, 'Available to sell', '◉', 'orange'],
      ['Sales value', currency(revenueTotal), 'All recorded sales', '↗', 'purple'],
    ]
    return <>
      <section className="hero"><div><span className="hero-kicker">FRESH PRODUCE · SMARTER DISTRIBUTION</span><h2>Good morning, Administrator</h2><p>Farm operations, all in one place. Here’s the latest overview.</p><button className="button button-light" onClick={() => setSection('Sales')}>＋ Record a sale</button></div><div className="hero-fruit" aria-hidden="true"><span>🍊</span><span>🍎</span><span>🍇</span><span>🥭</span></div></section>
      <div className="stat-grid">{stats.map(([label, value, caption, icon, tone]) => <article className="stat-card" key={label}><div className={`stat-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{caption}</small></article>)}</div>
      <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Recent sales</h3><p>Latest transactions</p></div><button className="text-button" onClick={() => setSection('Sales')}>View all →</button></div><Table columns={[{ key: 'sale_id', label: 'Sale' }, { key: 'vendor_name', label: 'Vendor' }, { key: 'sale_date', label: 'Date' }, { key: 'total_amount', label: 'Total', render: (row) => currency(row.total_amount) }, { key: 'payment_status', label: 'Status', render: (row) => <span className={`badge ${row.payment_status?.toLowerCase()}`}>{row.payment_status?.replace('_', ' ')}</span> }]} rows={data.sales.slice(0, 5)} empty="Recorded sales will appear here." /></section><section className="panel overview-panel"><div className="panel-heading"><div><h3>Stock watch</h3><p>Package sizes with 10 boxes or fewer</p></div><button className="text-button" onClick={() => setSection('Stock')}>Stock →</button></div><div className="stock-watch"><strong>{lowStock.length}</strong><span>low-stock items</span></div><div className="balance-line"><span>Outstanding payments</span><strong>{currency(outstandingTotal)}</strong></div><div className="balance-line"><span>Purchases recorded</span><strong>{data.purchases.length}</strong></div><button className="button button-outline full-width" onClick={() => navigateToSection('Reports')}>Open reports</button></section></div>
    </>
  }

  function renderSuppliers() {
    return <><Title eyebrow="PARTNERS" title="Suppliers" description="Keep fruit sourcing partners organized." /><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>Supplier directory</h3><p>{data.suppliers.length} registered suppliers</p></div></div><Table columns={[{ key: 'supplier_id', label: 'ID' }, { key: 'business_name', label: 'Business' }, { key: 'contact_person', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'province', label: 'Province' }, { key: 'address', label: 'Address' }, { key: 'actions', label: 'Actions', render: (row) => <div className="row-actions"><button className="table-action" onClick={() => viewRecord('supplier', row)}>View</button><button className="table-action" onClick={() => openEditor('supplier', row)}>Edit</button><button className="table-action danger" onClick={() => deleteSupplier(row)}>Delete</button></div> }]} rows={data.suppliers} empty="Add the first supplier using the form." /></section><section className={`panel form-panel ${formModal ? 'form-modal-open' : 'form-modal-hidden'}`}><h3>Add a supplier</h3><p className="muted">Register a new sourcing partner.</p><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); if (await save('/suppliers', 'POST', body, 'Supplier added.')) form.reset() }}><Field label="Business name"><input name="business_name" maxLength="100" required placeholder="e.g. Mountain Fresh Produce" /></Field><Field label="Contact person"><input name="contact_person" maxLength="100" required placeholder="Full name" /></Field><Field label="Phone number"><input name="phone" maxLength="20" required placeholder="+27 ..." /></Field><Field label="Province"><select name="province" required defaultValue=""><option value="" disabled>Select province</option>{provinces.map((province) => <option key={province}>{province}</option>)}</select></Field><Field label="Address"><textarea name="address" rows="3" placeholder="Street, town, country" /></Field><button className="button button-primary">Save supplier</button></form></section></div></>
  }

  function renderFruits() {
    return <><Title eyebrow="CATALOGUE" title="Fruits" description="Manage the fruit range and size-based selling prices." /><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>Fruit catalogue</h3><p>{activeFruits.length} available varieties</p></div></div><Table columns={[{ key: 'fruit_id', label: 'ID' }, { key: 'fruit_name', label: 'Fruit' }, { key: 'small_price', label: 'Small', render: (row) => currency(row.small_price) }, { key: 'medium_price', label: 'Medium', render: (row) => currency(row.medium_price) }, { key: 'large_price', label: 'Large', render: (row) => currency(row.large_price) }, { key: 'status', label: 'Status', render: (row) => <span className={`badge ${row.status === 'active' ? 'available' : row.status}`}>{row.status === 'active' ? 'Available' : 'Unavailable'}</span> }, { key: 'actions', label: 'Actions', render: (row) => <div className="row-actions"><button className="table-action" onClick={() => viewRecord('fruit', row)}>View</button><button className="table-action" onClick={() => openEditor('fruit', row)}>Edit</button><button className="table-action danger" onClick={() => deleteRecord('fruit', row)}>Delete</button></div> }]} rows={data.fruits} empty="Add fruits and prices to build the catalogue." /></section><section className={`panel form-panel ${formModal ? 'form-modal-open' : 'form-modal-hidden'}`}><h3>Add a fruit</h3><p className="muted">Set a separate price for each package size.</p><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); for (const key of ['small_price', 'medium_price', 'large_price']) body[key] = Number(body[key]); if (await save('/fruits', 'POST', body, 'Fruit added.')) form.reset() }}><Field label="Fruit name"><input name="fruit_name" maxLength="50" required placeholder="e.g. Apples" /></Field><Field label="Description"><textarea name="description" rows="2" placeholder="Optional details" /></Field><div className="price-grid">{sizes.map((size) => <Field label={`${size[0].toUpperCase()}${size.slice(1)} price`} key={size}><input name={`${size}_price`} type="number" min="0" step="0.01" required placeholder="0.00" /></Field>)}</div><button className="button button-primary">Save fruit</button></form></section></div></>
  }

  function renderVendors() {
    const rows = vendorResults ?? data.vendors
    return <><Title eyebrow="CUSTOMERS" title="Vendors" description="Manage street vendors and retail customers." /><section className="panel search-panel"><form className="search-form" onSubmit={search}><Field label="Search name or phone"><input value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Type a name or phone number" /></Field><button className="button button-outline">Search</button>{vendorResults && <button type="button" className="text-button" onClick={() => { setVendorResults(null); setVendorSearch('') }}>Clear</button>}</form></section><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>{vendorResults ? 'Search results' : 'Vendor directory'}</h3><p>{rows.length} {vendorResults ? 'matches' : 'registered vendors'}</p></div></div><Table columns={[{ key: 'vendor_id', label: 'ID' }, { key: 'vendor_name', label: 'Vendor' }, { key: 'phone_number', label: 'Phone' }, { key: 'location', label: 'Location' }, { key: 'registration_date', label: 'Registered' }, { key: 'actions', label: 'Actions', render: (row) => <div className="row-actions"><button className="table-action" onClick={() => viewRecord('vendor', row)}>View</button><button className="table-action" onClick={() => openEditor('vendor', row)}>Edit</button><button className="table-action danger" onClick={() => deleteRecord('vendor', row)}>Delete</button></div> }]} rows={rows} empty="Register or search for a vendor." /></section><section className={`panel form-panel ${formModal ? 'form-modal-open' : 'form-modal-hidden'}`}><h3>Register a vendor</h3><p className="muted">Add a customer to the network.</p><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); if (await save('/vendors', 'POST', body, 'Vendor added.')) form.reset() }}><Field label="Vendor name"><input name="vendor_name" maxLength="100" required placeholder="Full name or business" /></Field><Field label="Phone number"><input name="phone_number" maxLength="20" required placeholder="Phone number" /></Field><Field label="Location"><input name="location" maxLength="150" placeholder="Town or market" /></Field><Field label="Registration date"><input name="registration_date" type="date" defaultValue={today} required /></Field><button className="button button-primary">Save vendor</button></form></section></div></>
  }

  function renderPurchases() {
    return <><Title eyebrow="INBOUND STOCK" title="Purchases" description="Record deliveries from suppliers; stock updates automatically." /><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>Purchase history</h3><p>{data.purchases.length} recorded purchases</p></div></div><Table columns={[{ key: 'purchase_id', label: 'ID' }, { key: 'business_name', label: 'Supplier' }, { key: 'purchase_date', label: 'Date' }, { key: 'total_amount', label: 'Total', render: (row) => currency(row.total_amount) }]} rows={data.purchases} empty="Recorded purchases will appear here." /></section><section className={`panel form-panel wide-form ${formModal ? 'form-modal-open' : 'form-modal-hidden'}`}><h3>Record a purchase</h3><p className="muted">Add one or more items to a supplier delivery.</p><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const body = { supplier_id: Number(new FormData(form).get('supplier_id')), purchase_date: new FormData(form).get('purchase_date'), items: purchaseItems.map((item) => ({ fruit_id: Number(item.fruit_id), packaging_size: item.packaging_size, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost) })) }; if (await save('/purchases', 'POST', body, 'Purchase recorded.')) { setPurchaseItems([{ fruit_id: '', packaging_size: 'small', quantity: '', unit_cost: '' }]); form.reset() } }}><div className="form-row"><Field label="Supplier"><select name="supplier_id" required defaultValue=""><option value="" disabled>Select supplier</option>{data.suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.business_name}</option>)}</select></Field><Field label="Purchase date"><input name="purchase_date" type="date" defaultValue={today} required /></Field></div><div className="item-list"><div className="item-list-head"><strong>Purchase items</strong><button type="button" className="text-button" onClick={() => setPurchaseItems((items) => [...items, { fruit_id: '', packaging_size: 'small', quantity: '', unit_cost: '' }])}>＋ Add item</button></div>{purchaseItems.map((item, index) => <div className="line-item" key={index}><select aria-label="Fruit" value={item.fruit_id} onChange={(event) => setPurchaseItems((items) => items.map((entry, i) => i === index ? { ...entry, fruit_id: event.target.value } : entry))} required><option value="" disabled>Fruit</option>{activeFruits.map((fruit) => <option key={fruit.fruit_id} value={fruit.fruit_id}>{fruit.fruit_name}</option>)}</select><select aria-label="Package size" value={item.packaging_size} onChange={(event) => setPurchaseItems((items) => items.map((entry, i) => i === index ? { ...entry, packaging_size: event.target.value } : entry))}>{sizes.map((size) => <option key={size}>{size}</option>)}</select><input aria-label="Quantity" type="number" min="1" placeholder="Boxes" value={item.quantity} onChange={(event) => setPurchaseItems((items) => items.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} required /><input aria-label="Unit cost" type="number" min="0" step="0.01" placeholder="Cost / box" value={item.unit_cost} onChange={(event) => setPurchaseItems((items) => items.map((entry, i) => i === index ? { ...entry, unit_cost: event.target.value } : entry))} required />{purchaseItems.length > 1 && <button type="button" className="remove-button" aria-label="Remove item" onClick={() => setPurchaseItems((items) => items.filter((_, i) => i !== index))}>×</button>}</div>)}</div><button className="button button-primary">Save purchase &amp; update stock</button></form></section></div></>
  }

  function renderSales() {
    return <><Title eyebrow="OUTBOUND ORDERS" title="Sales" description="Create multi-item sales with automatic pricing and stock checks." /><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>Sales history</h3><p>{data.sales.length} recorded sales</p></div></div><Table columns={[{ key: 'sale_id', label: 'ID' }, { key: 'vendor_name', label: 'Vendor' }, { key: 'sale_date', label: 'Date' }, { key: 'total_amount', label: 'Total', render: (row) => currency(row.total_amount) }, { key: 'payment_status', label: 'Payment', render: (row) => <span className={`badge ${row.payment_status?.toLowerCase()}`}>{row.payment_status?.replace('_', ' ')}</span> }]} rows={data.sales} empty="Sales you record will appear here." /></section><section className={`panel form-panel wide-form ${formModal ? 'form-modal-open' : 'form-modal-hidden'}`}><h3>Record a sale</h3><p className="muted">Catalogue prices and stock are checked automatically.</p><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const formData = new FormData(form); const body = { vendor_id: Number(formData.get('vendor_id')), sale_date: formData.get('sale_date'), payment_method: formData.get('payment_method'), amount_paid: Number(formData.get('amount_paid') || 0), items: saleItems.map((item) => ({ fruit_id: Number(item.fruit_id), packaging_size: item.packaging_size, quantity: Number(item.quantity) })) }; if (await save('/sales', 'POST', body, 'Sale recorded.')) { setSaleItems([{ fruit_id: '', packaging_size: 'small', quantity: '' }]); form.reset() } }}><div className="form-row"><Field label="Vendor"><select name="vendor_id" required defaultValue=""><option value="" disabled>Select vendor</option>{data.vendors.map((vendor) => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.vendor_name}</option>)}</select></Field><Field label="Sale date"><input name="sale_date" type="date" defaultValue={today} required /></Field></div><div className="form-row"><Field label="Payment method"><select name="payment_method" defaultValue="CASH"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="CREDIT">Credit / unpaid</option></select></Field><Field label="Amount paid now"><input name="amount_paid" type="number" min="0" step="0.01" defaultValue="0" /></Field></div><div className="item-list"><div className="item-list-head"><strong>Sale items</strong><button type="button" className="text-button" onClick={() => setSaleItems((items) => [...items, { fruit_id: '', packaging_size: 'small', quantity: '' }])}>＋ Add item</button></div>{saleItems.map((item, index) => <div className="line-item sale-line" key={index}><select aria-label="Fruit" value={item.fruit_id} onChange={(event) => setSaleItems((items) => items.map((entry, i) => i === index ? { ...entry, fruit_id: event.target.value } : entry))} required><option value="" disabled>Fruit</option>{activeFruits.map((fruit) => <option key={fruit.fruit_id} value={fruit.fruit_id}>{fruit.fruit_name}</option>)}</select><select aria-label="Package size" value={item.packaging_size} onChange={(event) => setSaleItems((items) => items.map((entry, i) => i === index ? { ...entry, packaging_size: event.target.value } : entry))}>{sizes.map((size) => <option key={size}>{size}</option>)}</select><input aria-label="Quantity" type="number" min="1" placeholder="Boxes" value={item.quantity} onChange={(event) => setSaleItems((items) => items.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} required />{saleItems.length > 1 && <button type="button" className="remove-button" aria-label="Remove item" onClick={() => setSaleItems((items) => items.filter((_, i) => i !== index))}>×</button>}</div>)}</div><button className="button button-primary">Save sale &amp; update stock</button></form></section></div></>
  }

  function renderStock() {
    return <><Title eyebrow="INVENTORY" title="Stock levels" description="Track boxes by fruit and package size. Low stock is 10 boxes or fewer." action={<button className="button button-outline" onClick={refresh}>↻ Refresh stock</button>} /><section className="panel"><Table columns={[{ key: 'fruit_name', label: 'Fruit' }, { key: 'packaging_size', label: 'Package size', render: (row) => <span className="size-label">{row.packaging_size}</span> }, { key: 'available_quantity', label: 'Available boxes', render: (row) => <strong className={Number(row.available_quantity) <= 10 ? 'quantity-low' : 'quantity-good'}>{row.available_quantity}</strong> }, { key: 'stock_id', label: 'Status', render: (row) => Number(row.available_quantity) <= 10 ? <span className="badge warning">Low stock</span> : <span className="badge active">In stock</span> }]} rows={data.stock} empty="Stock will appear after you add fruits and record purchases." /></section></>
  }

  function renderReports() {
    return <><Title eyebrow="INSIGHTS" title="Reports" description="Understand sales performance, popular fruit, and vendor balances." /><section className="panel report-filter"><form className="search-form" onSubmit={(event) => { event.preventDefault(); void runReports() }}><Field label="From"><input type="date" value={range.start_date} onChange={(event) => setRange({ ...range, start_date: event.target.value })} required /></Field><Field label="To"><input type="date" value={range.end_date} onChange={(event) => setRange({ ...range, end_date: event.target.value })} required /></Field><button className="button button-primary">Run reports</button></form></section><div className="report-grid"><section className="panel"><div className="panel-heading"><div><h3>Top-selling fruits</h3><p>Ranked by boxes sold</p></div></div><Table columns={[{ key: 'fruit_name', label: 'Fruit' }, { key: 'boxes_sold', label: 'Boxes sold' }]} rows={reports.topFruits} empty="Sales data will populate this report." /></section><section className="panel highlight-report"><span className="eyebrow">SALES REVENUE</span><strong>{currency(reports.revenue?.total_sales_revenue)}</strong><p>{reports.revenue?.start_date || range.start_date} — {reports.revenue?.end_date || range.end_date}</p><small>{reports.revenue?.sales_count || 0} sales in this period</small></section><section className="panel highlight-report"><span className="eyebrow">TOP VENDOR BY BOXES</span><strong className="report-vendor">{reports.topVendor?.vendor_name || 'No sales yet'}</strong><p>{reports.topVendor ? `${reports.topVendor.boxes_purchased} boxes purchased` : 'Vendor ranking appears after sales are recorded.'}</p></section><section className="panel"><div className="panel-heading"><div><h3>Outstanding balances</h3><p>Total across vendors: {currency(outstandingTotal)}</p></div></div><Table columns={[{ key: 'vendor_name', label: 'Vendor' }, { key: 'phone_number', label: 'Phone' }, { key: 'outstanding_balance', label: 'Balance', render: (row) => currency(row.outstanding_balance) }]} rows={data.balances} empty="Vendor balances will appear here." /></section></div></>
  }

  function renderPayments() {
    return <><Title eyebrow="ACCOUNTS RECEIVABLE" title="Payments" description="Record payments against outstanding vendor sales." /><div className="stat-grid payment-stats"><article className="stat-card"><span>Outstanding balance</span><strong>{currency(outstandingTotal)}</strong><small>Across all vendors</small></article><article className="stat-card"><span>Unpaid / partial sales</span><strong>{openSales.length}</strong><small>Awaiting payment</small></article></div><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>Open balances</h3><p>Vendor sales that still have an amount due</p></div></div><Table columns={[{ key: 'sale_id', label: 'Sale' }, { key: 'vendor_name', label: 'Vendor' }, { key: 'total_amount', label: 'Total', render: (row) => currency(row.total_amount) }, { key: 'amount_paid', label: 'Paid', render: (row) => currency(row.amount_paid) }, { key: 'balance', label: 'Due', render: (row) => currency(Number(row.total_amount) - Number(row.amount_paid)) }, { key: 'payment_status', label: 'Status', render: (row) => <span className={`badge ${row.payment_status?.toLowerCase()}`}>{row.payment_status?.replace('_', ' ')}</span> }]} rows={openSales} empty="All sales are paid. Outstanding balances will appear here." /></section><section className={`panel form-panel ${formModal ? 'form-modal-open' : 'form-modal-hidden'}`}><h3>Record payment</h3><p className="muted">Apply cash or mobile money to an existing sale.</p><form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const ok = await save(`/sales/${values.get('sale_id')}/payments`, 'POST', { amount: Number(values.get('amount')), payment_method: values.get('payment_method') }, 'Payment recorded.'); if (ok) form.reset() }}><Field label="Sale"><select name="sale_id" required defaultValue=""><option value="" disabled>Select sale</option>{openSales.map((sale) => <option key={sale.sale_id} value={sale.sale_id}>#{sale.sale_id} · {sale.vendor_name} · Due {currency(Number(sale.total_amount) - Number(sale.amount_paid))}</option>)}</select></Field><Field label="Payment amount"><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></Field><Field label="Payment method"><select name="payment_method" defaultValue="CASH"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option></select></Field><button className="button button-primary" disabled={!openSales.length}>Apply payment</button><small className="form-hint">Payment cannot exceed the remaining balance.</small></form></section></div></>
  }

  const views = { Dashboard: renderDashboard, Suppliers: renderSuppliers, Fruits: renderFruits, Vendors: renderVendors, Purchases: renderPurchases, Sales: renderSales, Stock: renderStock, Reports: renderReports, Payments: renderPayments }

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">BF</div><div><strong>Batloung Farm</strong><span>Distribution system</span></div></div><div className="nav-caption">WORKSPACE</div><nav className="side-nav">{sections.map((label, index) => <button key={label} className={`nav-item ${section === label ? 'selected' : ''}`} onClick={() => navigateToSection(label)}><span className="nav-icon">{icons[index]}</span>{label}{label === 'Stock' && lowStock.length > 0 && <span className="nav-count">{lowStock.length}</span>}</button>)}</nav><div className="sidebar-footer"><div className="online-dot" />API connected<span>Farm workspace</span></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{section}</strong></div><div className="topbar-right"><button className="icon-button" onClick={refresh} title="Refresh data" aria-label="Refresh data">↻</button><div className="user-chip"><div className="avatar">A</div><div><strong>Administrator</strong><span>Farm manager</span></div></div></div></header><div className="page-content">{notice && <div className={`notice ${notice.type}`} role="status">{notice.type === 'success' ? '✓' : '!'} {notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}{busy && <div className="loading-bar" />}{views[section]?.()}</div>{editor && <RecordEditor editor={editor} onClose={() => setEditor(null)} onSave={(path, body) => save(path, 'PUT', body, 'Record updated.')} />}{viewer && <RecordViewer viewer={viewer} onClose={() => setViewer(null)} />}{formModal && <button className="form-scrim" onClick={closeForm} aria-label="Close form" />}{canCreate && <button className={`form-toggle ${formModal ? 'is-open' : ''}`} onClick={() => setFormModal((open) => !open)} aria-label={formModal ? 'Close form' : `Open ${section.toLowerCase()} form`} title={formModal ? 'Close form' : `Add ${section.toLowerCase()}`}>{formModal ? '×' : '+'}</button>}<footer className="app-footer"><span>© {currentYear} Batloung Farm</span><span>Fresh produce, thoughtfully distributed.</span></footer></main></div>
}

export default App