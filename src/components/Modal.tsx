import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

export default function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}) {
  // <dialog> native: Escape chỉ đóng modal trên cùng, focus bị giữ trong modal.
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (open && d && !d.open) d.showModal()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${maxWidth} overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/45 backdrop:backdrop-blur-[1px]`}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  )
}

