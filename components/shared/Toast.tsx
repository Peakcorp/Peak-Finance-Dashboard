'use client'

import { create } from 'zustand'
import { useEffect } from 'react'

interface ToastItem {
  id: number
  message: string
}

interface ToastStore {
  toasts: ToastItem[]
  push: (message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, message }] }))
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function pushToast(message: string) {
  useToastStore.getState().push(message)
}

export function ToastHost() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} id={t.id} message={t.message} onDismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastCard({ id, message, onDismiss }: { id: number; message: string; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 6000)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  return (
    <div className="pointer-events-auto max-w-sm rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-lg">
      {message}
    </div>
  )
}
