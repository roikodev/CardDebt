import type { TFunction } from "i18next"

export function getPasswordPolicyBullets(t: TFunction): readonly string[] {
  return t("auth.passwordPolicy.bullets", { returnObjects: true }) as readonly string[]
}
