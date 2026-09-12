/** Customer cart — prd.md §12. Persisted so a refresh mid-order doesn't lose the basket. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { MenuItem } from '@/lib/types'

export interface CartLine {
  /** Stable signature so the same dish + options merge into one line. */
  signature: string
  menuItemId: string
  name: string
  unitPrice: number
  quantity: number
  options: string[]
  optionsTotal: number
  notes: string
}

interface CartValue {
  lines: CartLine[]
  count: number
  subtotal: number
  addLine: (input: {
    item: MenuItem
    quantity: number
    options: string[]
    optionsTotal: number
    notes: string
  }) => void
  setQuantity: (signature: string, quantity: number) => void
  removeLine: (signature: string) => void
  updateNotes: (signature: string, notes: string) => void
  clear: () => void
}

const CartContext = createContext<CartValue | null>(null)
const STORAGE_KEY = 'biteflow.cart.v1'

const signatureOf = (menuItemId: string, options: string[], notes: string) =>
  [menuItemId, [...options].sort().join('|'), notes.trim()].join('::')

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    if (typeof localStorage === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartLine[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* ignore */
    }
  }, [lines])

  const addLine = useCallback<CartValue['addLine']>(({ item, quantity, options, optionsTotal, notes }) => {
    const signature = signatureOf(item.id, options, notes)
    setLines((prev) => {
      const existing = prev.find((l) => l.signature === signature)
      if (existing) {
        return prev.map((l) =>
          l.signature === signature ? { ...l, quantity: l.quantity + quantity } : l,
        )
      }
      return [
        ...prev,
        {
          signature,
          menuItemId: item.id,
          name: item.name,
          unitPrice: item.price,
          quantity,
          options,
          optionsTotal,
          notes,
        },
      ]
    })
  }, [])

  const setQuantity = useCallback<CartValue['setQuantity']>((signature, quantity) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.signature !== signature)
        : prev.map((l) => (l.signature === signature ? { ...l, quantity } : l)),
    )
  }, [])

  const removeLine = useCallback<CartValue['removeLine']>((signature) => {
    setLines((prev) => prev.filter((l) => l.signature !== signature))
  }, [])

  const updateNotes = useCallback<CartValue['updateNotes']>((signature, notes) => {
    setLines((prev) => prev.map((l) => (l.signature === signature ? { ...l, notes } : l)))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartValue>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0)
    const subtotal = lines.reduce((s, l) => s + (l.unitPrice + l.optionsTotal) * l.quantity, 0)
    return { lines, count, subtotal, addLine, setQuantity, removeLine, updateNotes, clear }
  }, [lines, addLine, setQuantity, removeLine, updateNotes, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
