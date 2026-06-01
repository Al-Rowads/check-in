import type { ToastMessage } from "../hooks/useToasts";
import { cn } from "../lib/cn";

type ToastViewportProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

const toneClasses: Record<ToastMessage["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  warning: "border-orange-200 bg-orange-50 text-orange-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div className="fixed right-4 top-4 z-50 grid w-[min(26rem,calc(100vw-2rem))] gap-3">
      {toasts.map((toast) => (
        <button
          aria-label={`Dismiss notification: ${toast.title}`}
          className={cn(
            "grid gap-1 rounded-md border p-4 text-left shadow-soft transition hover:translate-y-0.5",
            toneClasses[toast.tone],
          )}
          key={toast.id}
          onClick={() => onDismiss(toast.id)}
          type="button"
        >
          <span className="text-sm font-bold">{toast.title}</span>
          {toast.description ? (
            <span className="text-sm leading-5 opacity-80">{toast.description}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
