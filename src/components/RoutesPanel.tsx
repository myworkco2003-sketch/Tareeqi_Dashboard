import type { RouteEditor } from '../hooks/useRouteEditor'
import type { MapRoute } from '../types'

type Props = {
  routes: MapRoute[]
  editor: RouteEditor
  onDelete: (route: MapRoute) => void
}

// اللوحة الجانبية: قائمة الخطوط، أو نموذج إضافة/تعديل خط
export default function RoutesPanel({ routes, editor, onDelete }: Props) {
  const canSave =
    editor.hasRoute &&
    !editor.busy &&
    !editor.saving &&
    editor.name.trim() !== '' &&
    editor.fare !== '' &&
    Number(editor.fare) >= 0

  return (
    <aside className="routes-editor-side">
      {!editor.editing ? (
        <>
          <button type="button" onClick={editor.startNew}>
            + إضافة خط جديد
          </button>

          {routes.map((r) => (
            <div key={r.id} className="route-item">
              <span className="route-color" style={{ backgroundColor: r.color }} />
              <span>{r.route_name}</span>
              <button type="button" onClick={() => editor.startEdit(r)}>
                تعديل
              </button>
              <button type="button" onClick={() => onDelete(r)}>
                حذف
              </button>
            </div>
          ))}
        </>
      ) : (
        <>
          <h3>{editor.editingId ? 'تعديل الخط' : 'خط جديد'}</h3>

          <label>
            اسم الخط
            <input
              type="text"
              value={editor.name}
              placeholder="مثال: خط 19"
              onChange={(e) => editor.setName(e.target.value)}
            />
          </label>

          <label>
            اللون
            <input
              type="color"
              value={editor.color}
              onChange={(e) => editor.setColor(e.target.value)}
            />
          </label>

          <label>
            الأجرة
            <input
              type="number"
              min="0"
              value={editor.fare}
              placeholder="مثال: 500"
              onChange={(e) => editor.setFare(e.target.value)}
            />
          </label>

          <p className="routes-editor-hint">
            اضغط على الخريطة لإضافة نقطة، اسحب النقطة لتغييرها، كليك يمين لحذفها،
            واضغط على الخط لإدراج نقطة بالنص.
          </p>

          {editor.busy && <small>جاري حساب المسار…</small>}

          <button type="button" onClick={editor.undo} disabled={editor.count === 0}>
            تراجع
          </button>
          <button type="button" onClick={editor.save} disabled={!canSave}>
            {editor.saving ? 'جاري الحفظ…' : 'حفظ'}
          </button>
          <button type="button" onClick={editor.cancel} disabled={editor.saving}>
            إلغاء
          </button>
        </>
      )}

      {editor.error && <small className="routes-editor-error">{editor.error}</small>}
    </aside>
  )
}