import type { TFunction } from "i18next"
import { z } from "zod"

import { GAME_TITLE_VALUES } from "@/lib/gameTitles"

export function loginSchema(t: TFunction) {
  return z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
    password: z.string().min(8, t("auth.validation.passwordMinLogin")),
  })
}

export function signupSchema(t: TFunction) {
  return z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
    password: passwordFieldSchema(t),
  })
}

export function otpSchema(t: TFunction) {
  return z.object({
    token: z
      .string()
      .regex(/^[0-9]{6}$/, t("auth.validation.otpSixDigits"))
      .transform((v) => v.trim()),
  })
}

export function newPasswordSchema(t: TFunction) {
  return z
    .object({
      password: passwordFieldSchema(t),
      confirmPassword: z.string().min(1, t("auth.validation.confirmRequired")),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t("auth.validation.passwordsMismatch"),
      path: ["confirmPassword"],
    })
}

export function passwordFieldSchema(t: TFunction) {
  return z
    .string()
    .min(8, t("auth.validation.passwordMin8"))
    .regex(/[a-z]/, t("auth.validation.passwordLower"))
    .regex(/[A-Z]/, t("auth.validation.passwordUpper"))
    .regex(/[0-9]/, t("auth.validation.passwordNumber"))
}

export function emailOnlySchema(t: TFunction) {
  return z.object({
    email: z.string().email(t("auth.validation.emailInvalid")),
  })
}

export function createBuyProductFormSchema(t: TFunction) {
  const bf = (key: string) => t(`dialogs.buyForm.${key}`)
  return z
    .object({
      sourceImage: z.preprocess(
        (v) => (v === null ? undefined : v),
        z.custom<File>(
          (v) => typeof File !== "undefined" && v instanceof File,
          { message: bf("sourceImageRequired") }
        )
      ),
      gameTitle: z.enum(GAME_TITLE_VALUES).nullable().optional(),
      category: z.enum(["Card", "Product"]),
      cardNo: z.string(),
      name: z.string().min(1, bf("nameRequired")),
      graded: z.boolean(),
      price: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
        z.number()
      ),
      quantity: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
        z.number().int(bf("quantityInt")).min(1, bf("quantityMin"))
      ),
      purchaseDate: z.string().min(1, bf("purchaseDateRequired")),
      provider: z.string().min(1, bf("providerRequired")),
      grade: z.string(),
    })
    .refine(
      (data) => {
        if (data.category !== "Card") return true
        return data.cardNo.trim().length > 0
      },
      { path: ["cardNo"], message: bf("cardNoRequired") }
    )
    .refine(
      (data) => {
        if (!data.graded) return true
        return data.provider.trim().length > 0
      },
      { path: ["provider"], message: bf("providerRequired") }
    )
    .refine(
      (data) => {
        if (!data.graded) return true
        const n = parseFloat(data.grade)
        return !Number.isNaN(n) && n > 0
      },
      { path: ["grade"], message: bf("gradeMin") }
    )
    .refine(
      (data) => Number.isFinite(data.price) && !Number.isNaN(data.price),
      { path: ["price"], message: bf("priceRequired") }
    )
    .refine(
      (data) => Number.isFinite(data.quantity) && !Number.isNaN(data.quantity),
      { path: ["quantity"], message: bf("quantityRequired") }
    )
}

export function createBuyByCardBaseFormSchema(t: TFunction) {
  const bf = (key: string) => t(`dialogs.buyForm.${key}`)
  return z
    .object({
      graded: z.boolean(),
      price: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
        z.number()
      ),
      quantity: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
        z.number().int(bf("quantityInt")).min(1, bf("quantityMin"))
      ),
      purchaseDate: z.string().min(1, bf("purchaseDateRequired")),
      provider: z.string().min(1, bf("providerRequired")),
      grade: z.string(),
    })
    .refine(
      (data) => {
        if (!data.graded) return true
        return data.provider.trim().length > 0
      },
      { path: ["provider"], message: bf("providerRequired") }
    )
    .refine(
      (data) => {
        if (!data.graded) return true
        const n = parseFloat(data.grade)
        return !Number.isNaN(n) && n > 0
      },
      { path: ["grade"], message: bf("gradeMin") }
    )
    .refine(
      (data) => Number.isFinite(data.price) && !Number.isNaN(data.price),
      { path: ["price"], message: bf("priceRequired") }
    )
    .refine(
      (data) => Number.isFinite(data.quantity) && !Number.isNaN(data.quantity),
      { path: ["quantity"], message: bf("quantityRequired") }
    )
}
