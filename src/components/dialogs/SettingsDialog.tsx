import { useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormSelectField } from "@/components/form-input"
import { Separator } from "@/components/ui/separator"
import { LANGUAGE_OPTIONS, type AppLanguage } from "@/lib/languages"
import { useAuthStore } from "@/stores/auth"
import { useLanguageStore } from "@/stores/language"
import { KeyRound } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  function handleChangePassword() {
    onOpenChange(false)
    navigate({ to: "/auth/forget-password" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t("settings.signedInAs")}</p>
            <p className="truncate text-sm font-medium">{user?.email ?? t("common.emDash")}</p>
          </div>

          <Separator />

          <FormSelectField label={t("settings.language")} htmlFor="settings-language">
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v as AppLanguage)}
            >
              <SelectTrigger id="settings-language" className="w-full" size="default">
                <SelectValue placeholder={t("settings.languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormSelectField>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">{t("settings.password")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.passwordHint")}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleChangePassword}
            >
              <KeyRound data-icon="inline-start" aria-hidden="true" />
              {t("settings.changePassword")}
            </Button>
          </div>
        </DialogBody>

        <DialogFooter
          showCloseButton
          className="border-t border-border/50 bg-muted/30 px-4 py-3 sm:px-6 sm:py-4"
        />
      </DialogContent>
    </Dialog>
  )
}
