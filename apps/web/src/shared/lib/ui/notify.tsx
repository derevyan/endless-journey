import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, InfoIcon, XIcon } from "lucide-react";
import { toast, type ExternalToast } from "sonner";

import { Button } from "@/shared/components/ui/button";

type NotifyOptions = Omit<ExternalToast, "description"> & {
  description?: string;
};

type ToastVariant = "success" | "error" | "warning" | "info";

const variantConfig: Record<ToastVariant, { icon: typeof CircleCheckIcon; colorClass: string }> = {
  success: { icon: CircleCheckIcon, colorClass: "text-success" },
  error: { icon: CircleXIcon, colorClass: "text-destructive" },
  warning: { icon: CircleAlertIcon, colorClass: "text-warning" },
  info: { icon: InfoIcon, colorClass: "text-info" },
};

function createToastContent(variant: ToastVariant, message: string, description?: string, toastId?: string | number) {
  const { icon: Icon, colorClass } = variantConfig[variant];

  return (
    <div className="flex w-full gap-2">
      <div className="flex grow flex-col gap-1">
        <p className="text-sm">
          <Icon aria-hidden="true" className={`-mt-0.5 me-3 inline-flex ${colorClass}`} size={16} />
          {message}
        </p>
        {description && <p className="pl-7 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Button
        aria-label="Close notification"
        className="group -my-1.5 -me-2 size-8 shrink-0 cursor-pointer p-0 hover:bg-transparent"
        variant="ghost"
        onClick={() => toast.dismiss(toastId)}
      >
        <XIcon aria-hidden="true" className="opacity-60 transition-opacity group-hover:opacity-100" size={16} />
      </Button>
    </div>
  );
}

function createNotify(variant: ToastVariant) {
  return (message: string, options?: NotifyOptions) => {
    const { description, ...restOptions } = options || {};
    const id = restOptions.id ?? Date.now();

    return toast.custom(() => createToastContent(variant, message, description, id), {
      ...restOptions,
      id,
    });
  };
}

/**
 * Custom toast notification utility with styled variants.
 *
 * @example
 * ```tsx
 * import { notify } from "@/shared/lib/ui/notify";
 *
 * notify.success("Saved successfully");
 * notify.error("Failed to save", { description: "Please try again" });
 * notify.warning("Connection unstable");
 * notify.info("New version available");
 * ```
 */
export const notify = {
  success: createNotify("success"),
  error: createNotify("error"),
  warning: createNotify("warning"),
  info: createNotify("info"),

  /**
   * Dismiss a specific toast by ID or all toasts if no ID provided.
   */
  dismiss: toast.dismiss,

  /**
   * Promise-based toast for async operations.
   * Shows loading state, then success/error based on promise result.
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: NotifyOptions
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: (data) => {
        const message = typeof messages.success === "function" ? messages.success(data) : messages.success;
        const { icon: Icon, colorClass } = variantConfig.success;
        return (
          <div className="flex w-full gap-2">
            <p className="grow text-sm">
              <Icon aria-hidden="true" className={`-mt-0.5 me-3 inline-flex ${colorClass}`} size={16} />
              {message}
            </p>
          </div>
        );
      },
      error: (err) => {
        const message = typeof messages.error === "function" ? messages.error(err) : messages.error;
        const { icon: Icon, colorClass } = variantConfig.error;
        return (
          <div className="flex w-full gap-2">
            <p className="grow text-sm">
              <Icon aria-hidden="true" className={`-mt-0.5 me-3 inline-flex ${colorClass}`} size={16} />
              {message}
            </p>
          </div>
        );
      },
      ...options,
    });
  },
};
