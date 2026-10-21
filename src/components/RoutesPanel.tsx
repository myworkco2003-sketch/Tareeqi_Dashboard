import { useState } from 'react'
import { createBus } from '../api'
import type { Bus } from '../types'
import type { RouteEditor } from '../hooks/useRouteEditor'
import type { MapRoute } from '../types'

type Props = {
  routes: MapRoute[]
  buses: Bus[]
  editor: RouteEditor
  onDelete: (route: MapRoute) => void
  onBusesChanged: () => Promise<void> | void
}

export default function RoutesPanel({ routes, buses, editor, onDelete, onBusesChanged }: Props) {
  const [addingBus, setAddingBus] = useState(false)
  const [busName, setBusName] = useState('')
  const [busColor, setBusColor] = useState('#2563eb')
  const [oldPrice, setOldPrice] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [busError, setBusError] = useState('')
  const [busSaving, setBusSaving] = useState(false)

  const canSave = editor.hasRoute && !editor.busy && !editor.saving &&
    editor.busId !== '' && editor.direction.trim() !== '' &&
    editor.distance !== null && editor.tripTime !== null

  const saveBus = async () => {
    if (!busName.trim()) { setBusError('اكتب اسم الباص'); return }
    setBusSaving(true); setBusError('')
    try {
      const bus = await createBus({
        name: busName.trim(), color: busColor || null,
        old_price: oldPrice === '' ? null : Number(oldPrice),
        new_price: newPrice === '' ? null : Number(newPrice),
        is_active: true,
      })
      await onBusesChanged()
      editor.setBusId(String(bus.id))
      setBusName(''); setOldPrice(''); setNewPrice(''); setAddingBus(false)
    } catch (e) {
      setBusError(e instanceof Error ? e.message : 'تعذر إضافة الباص')
    } finally { setBusSaving(false) }
  }

  return (
    <aside className="routes-editor-side">
      {!editor.editing ? (
        <>
          <button type="button" onClick={() => { editor.startNew(buses[0] ? String(buses[0].id) : ''); setAddingBus(false) }}>
            + إضافة مسار باص
          </button>
          <button type="button" onClick={() => setAddingBus((v) => !v)}>+ إضافة باص جديد</button>
          {addingBus && (
            <div className="bus-create-form">
              <h3>باص جديد</h3>
              <label>اسم الباص<input value={busName} onChange={(e) => setBusName(e.target.value)} placeholder="مثال: باص 19" /></label>
              <label>اللون<input type="color" value={busColor} onChange={(e) => setBusColor(e.target.value)} /></label>
              <label>السعر القديم<input type="number" min="0" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} /></label>
              <label>السعر الجديد<input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /></label>
              <button type="button" disabled={busSaving} onClick={saveBus}>{busSaving ? 'جاري الحفظ…' : 'حفظ الباص'}</button>
              <button type="button" onClick={() => setAddingBus(false)}>إلغاء</button>
              {busError && <small className="routes-editor-error">{busError}</small>}
            </div>
          )}
          <h3>المسارات المسجلة ({routes.length})</h3>
          {routes.map((r) => (
            <div key={r.id} className="route-item">
              <span className="route-color" style={{ backgroundColor: r.bus.color ?? '#888' }} />
              <span>{r.bus.name} — {r.direction} (v{r.version})</span>
              <button type="button" onClick={() => editor.startEdit(r)}>تعديل</button>
              <button type="button" onClick={() => onDelete(r)}>تعطيل</button>
            </div>
          ))}
        </>
      ) : (
        <>
          <h3>{editor.editingId !== null ? 'تعديل مسار' : 'مسار جديد'}</h3>
          <label>الباص
            <select value={editor.busId} onChange={(e) => editor.setBusId(e.target.value)}>
              <option value="">اختر الباص</option>
              {buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.name} {bus.is_active ? '' : '(غير نشط)'}</option>)}
            </select>
          </label>
          <label>الاتجاه
            <select value={editor.direction} onChange={(e) => editor.setDirection(e.target.value)}>
              <option value="forward">ذهاب</option>
              <option value="reverse">إياب</option>
            </select>
          </label>
          <label><input type="checkbox" checked={editor.isActive} onChange={(e) => editor.setIsActive(e.target.checked)} /> مسار نشط</label>
          <p>المسافة: {editor.distance === null ? '—' : `${(editor.distance / 1000).toFixed(2)} كم`}</p>
          <p>زمن الرحلة: {editor.tripTime === null ? '—' : `${editor.tripTime} دقيقة`}</p>
          <p className="routes-editor-hint">
            اضغط على الخريطة لإضافة نقطة، اسحب النقطة لتغييرها، كليك يمين لحذفها،
            واضغط على الخط لإدراج نقطة بالنص. تُحسب المسافة والزمن عبر BRouter.
          </p>
          {editor.busy && <small>جاري حساب المسار…</small>}
          <button type="button" onClick={editor.undo} disabled={editor.count === 0}>تراجع</button>
          <button type="button" onClick={editor.save} disabled={!canSave}>{editor.saving ? 'جاري الحفظ…' : 'حفظ المسار'}</button>
          <button type="button" onClick={editor.cancel} disabled={editor.saving}>إلغاء</button>
        </>
      )}
      {editor.error && <small className="routes-editor-error">{editor.error}</small>}
    </aside>
  )
}
