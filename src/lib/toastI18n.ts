import i18n from "@/i18n/config"
import { toast } from "sonner"

const TOAST_DURATION = 5000

export function toastSaved() {
  toast.success(i18n.t("toasts.saved"), { duration: TOAST_DURATION })
}

export function toastUpdated() {
  toast.success(i18n.t("toasts.updated"), { duration: TOAST_DURATION })
}

export function toastCancelled() {
  toast.success(i18n.t("toasts.cancelled"), { duration: TOAST_DURATION })
}

export function toastRecovered() {
  toast.success(i18n.t("toasts.recovered"), { duration: TOAST_DURATION })
}

export function toastDeleted() {
  toast.success(i18n.t("toasts.deleted"), { duration: TOAST_DURATION })
}

export function toastSold() {
  toast.success(i18n.t("toasts.sold"), { duration: TOAST_DURATION })
}
