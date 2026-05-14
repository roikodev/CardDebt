import { z } from "zod"

/**
 * Client-side rules aligned with a typical “strong password” policy.
 * Keep Supabase project settings in sync if you enforce stricter rules server-side.
 */
export const passwordFieldSchema = z
  .string()
  .min(8, "At least 8 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")

/** Point-form checklist in the password hint panel (signup / reset). */
export const PASSWORD_POLICY_BULLETS: readonly string[] = [
  "8 or more characters",
  "At least one lowercase letter (a–z)",
  "At least one uppercase letter (A–Z)",
  "At least one number (0–9)",
]
