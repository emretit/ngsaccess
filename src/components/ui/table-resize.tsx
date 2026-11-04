import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Sürüklenebilir tablo sütunları.
 *
 * `<Table resizeKey="...">` içindeki her `<TableHead columnId="...">` sağ kenarında
 * bir tutamak gösterir. İlk sürüklemede görünen tüm sütunların o anki genişliği
 * dondurulur (tablo `table-layout: fixed` olur), böylece yalnızca sürüklenen sütun
 * değişir. Genişlikler tarayıcıda `localStorage`'a yazılır; çift tık sıfırlar.
 */

type ColumnWidths = Record<string, number>

const MIN_COLUMN_WIDTH = 48
export const FALLBACK_COLUMN_WIDTH = 140
const KEYBOARD_STEP = 16
const STORAGE_PREFIX = "ngs:table-widths:"

function readWidths(resizeKey: string): ColumnWidths {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + resizeKey)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const widths: ColumnWidths = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        widths[id] = Math.round(value)
      }
    }
    return widths
  } catch {
    return {}
  }
}

function writeWidths(resizeKey: string, widths: ColumnWidths) {
  try {
    if (Object.keys(widths).length === 0) window.localStorage.removeItem(STORAGE_PREFIX + resizeKey)
    else window.localStorage.setItem(STORAGE_PREFIX + resizeKey, JSON.stringify(widths))
  } catch {
    // Gizli mod / kota: genişlik yalnızca bu oturumda kalır.
  }
}

const isVisible = (el: Element) => el.getClientRects().length > 0

type ColumnResizeContextValue = {
  widths: ColumnWidths
  frozen: boolean
  register: (id: string, el: HTMLTableCellElement | null) => void
  /** Görünen sütunları dondurur, sürüklemenin başlayacağı genişliği döner. */
  begin: (id: string) => number
  setWidth: (id: string, width: number, minWidth?: number) => void
  reset: () => void
}

const ColumnResizeContext = React.createContext<ColumnResizeContextValue | null>(null)

type ResizeState = { key: string | undefined; widths: ColumnWidths; dirty: boolean }

const initialState = (resizeKey: string | undefined): ResizeState => ({
  key: resizeKey,
  widths: resizeKey ? readWidths(resizeKey) : {},
  dirty: false,
})

export function useColumnResizeState(resizeKey: string | undefined) {
  const [state, setState] = React.useState(() => initialState(resizeKey))
  // Anahtar değişirse (ör. sütun seti değişen tablo) o anahtarın kayıtlı genişliklerine geç.
  if (state.key !== resizeKey) setState(initialState(resizeKey))
  const { widths } = state
  const setWidths = React.useCallback((update: (prev: ColumnWidths) => ColumnWidths) => {
    setState((prev) => {
      const next = update(prev.widths)
      return next === prev.widths ? prev : { ...prev, widths: next, dirty: true }
    })
  }, [])
  const cells = React.useRef(new Map<string, HTMLTableCellElement>())
  const tableRef = React.useRef<HTMLTableElement | null>(null)
  const wroteWidth = React.useRef(false)
  const widthsRef = React.useRef(widths)
  React.useLayoutEffect(() => {
    widthsRef.current = widths
  }, [widths])
  const frozen = Boolean(resizeKey) && Object.keys(widths).length > 0

  // Sürükleme sırasında her adımda değil, durunca yaz; tablo kapanırken bekleyeni yaz.
  const pendingWrite = React.useRef<ResizeState | null>(null)
  React.useEffect(() => {
    if (!state.key || !state.dirty) return
    pendingWrite.current = state
    const timer = window.setTimeout(() => {
      pendingWrite.current = null
      if (state.key) writeWidths(state.key, state.widths)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [state])
  React.useEffect(() => () => {
    const pending = pendingWrite.current
    if (pending?.key) writeWidths(pending.key, pending.widths)
  }, [])

  // Dondurulmuş tabloda genişlik = görünen sütunların toplamı; kırılım değişince yeniden hesaplanır.
  React.useLayoutEffect(() => {
    const table = tableRef.current
    if (!table) return
    if (!frozen) {
      if (wroteWidth.current) table.style.removeProperty("width")
      wroteWidth.current = false
      return
    }
    const apply = () => {
      // Mobilde tablo kart düzenine (display: block) geçebilir; orada sabit genişlik kartları daraltır.
      if (getComputedStyle(table).display !== "table") {
        if (wroteWidth.current) table.style.removeProperty("width")
        wroteWidth.current = false
        return
      }
      const row = table.tHead?.rows[table.tHead.rows.length - 1]
      if (!row) return
      let sum = 0
      for (const cell of Array.from(row.cells)) {
        if (!isVisible(cell)) continue
        const id = cell.dataset.columnId
        sum += id ? (widthsRef.current[id] ?? FALLBACK_COLUMN_WIDTH) : cell.getBoundingClientRect().width
      }
      if (sum > 0) {
        table.style.width = `${Math.round(sum)}px`
        wroteWidth.current = true
      }
    }
    apply()
    window.addEventListener("resize", apply)
    return () => window.removeEventListener("resize", apply)
  }, [frozen, widths])

  // Eylemler sabit kalır: sürükleme sırasında yalnızca widths/frozen değişir, hücre ref'leri yeniden bağlanmaz.
  const actions = React.useMemo<Omit<ColumnResizeContextValue, "widths" | "frozen">>(() => ({
    register: (id, el) => {
      if (el) cells.current.set(id, el)
      else cells.current.delete(id)
    },
    begin: (id) => {
      const current = widthsRef.current
      const next: ColumnWidths = { ...current }
      cells.current.forEach((el, cellId) => {
        if (next[cellId] === undefined && isVisible(el)) {
          next[cellId] = Math.round(el.getBoundingClientRect().width)
        }
      })
      if (Object.keys(next).length !== Object.keys(current).length) setWidths(() => next)
      return next[id] ?? FALLBACK_COLUMN_WIDTH
    },
    setWidth: (id, width, minWidth = MIN_COLUMN_WIDTH) => {
      const rounded = Math.max(minWidth, Math.round(width))
      setWidths((prev) => (prev[id] === rounded ? prev : { ...prev, [id]: rounded }))
    },
    reset: () => setWidths(() => ({})),
  }), [setWidths])

  const context = React.useMemo<ColumnResizeContextValue>(
    () => ({ widths, frozen, ...actions }),
    [widths, frozen, actions]
  )

  return { context: resizeKey ? context : null, tableRef, frozen }
}

export function ColumnResizeProvider({
  value,
  children,
}: {
  value: ColumnResizeContextValue | null
  children: React.ReactNode
}) {
  return <ColumnResizeContext.Provider value={value}>{children}</ColumnResizeContext.Provider>
}

export function useColumnResize() {
  return React.useContext(ColumnResizeContext)
}

export function ColumnResizeHandle({
  columnId,
  label,
  minWidth = MIN_COLUMN_WIDTH,
}: {
  columnId: string
  label?: string
  minWidth?: number
}) {
  const resize = useColumnResize()
  const drag = React.useRef<{ startX: number; startWidth: number } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  if (!resize) return null
  const width = resize.widths[columnId]

  const stopDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.style.removeProperty("cursor")
    document.body.style.removeProperty("user-select")
  }

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label ? `${label} sütun genişliği` : "Sütun genişliği"}
      aria-valuemin={minWidth}
      aria-valuenow={width}
      tabIndex={0}
      title="Sürükleyerek genişliği değiştir · çift tıkla sıfırla"
      data-resizing={dragging || undefined}
      className={cn(
        "absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize touch-none select-none justify-center outline-none",
        "after:h-full after:w-px after:bg-transparent after:transition-colors",
        "[tr:hover_&]:after:bg-border hover:after:bg-primary focus-visible:after:w-0.5 focus-visible:after:bg-primary data-[resizing]:after:bg-primary"
      )}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation()
        resize.reset()
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        drag.current = { startX: event.clientX, startWidth: resize.begin(columnId) }
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        resize.setWidth(columnId, drag.current.startWidth + event.clientX - drag.current.startX, minWidth)
      }}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
        event.preventDefault()
        const start = resize.begin(columnId)
        resize.setWidth(columnId, start + (event.key === "ArrowRight" ? KEYBOARD_STEP : -KEYBOARD_STEP), minWidth)
      }}
    />
  )
}
