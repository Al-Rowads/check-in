import type { ToastMessage } from "../hooks/useToasts";
import { cn } from "../lib/cn";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type ToastViewportProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

const toneClasses: Record<ToastMessage["tone"], string> = {
  success: "border-emerald-400/30 bg-[#06150D]/96 text-emerald-50",
  info: "border-alrowad-blue/45 bg-[#050717]/96 text-blue-50",
  warning: "border-alrowad-flame/35 bg-[#190B02]/96 text-orange-50",
  error: "border-alrowad-red/40 bg-[#1A0303]/96 text-red-50",
};

const toastIcons: Record<ToastMessage["tone"], typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div className="fixed right-4 top-4 z-50 grid w-[min(28rem,calc(100vw-2rem))] gap-3">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.tone];

        return (
          <button
            aria-label={`Dismiss notification: ${toast.title}`}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border p-4 text-left shadow-soft backdrop-blur transition hover:translate-y-0.5",
              toneClasses[toast.tone],
            )}
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            type="button"
          >
            <Icon aria-hidden="true" className="mt-0.5 size-5" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">{toast.title}</span>
              {toast.description ? (
                <span className="mt-1 block text-sm leading-5 text-white/68">
                  {toast.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
