import type { SupabaseClient } from "@supabase/supabase-js"
import type { TFunction } from "i18next"

export type DerivedMappingRef = {
  recordId: string
  toUserCollectionId: string
}

export type DerivedTargetInfo = {
  toUserCollectionId: string
  exists: boolean
  deleted: boolean
  collection_item_id: string | null
  graded: boolean
  grading: boolean
  currentQty: number
}

export async function loadDerivedTargetInfo(
  supabase: SupabaseClient,
  userId: string,
  toUserCollectionId: string
): Promise<{ data: DerivedTargetInfo | null; error: string | null }> {
  const toRes = await supabase
    .from("user_collection")
    .select("id, deleted, collection_item_id, graded, grading")
    .eq("user_id", userId)
    .eq("id", toUserCollectionId)
    .maybeSingle()

  if (toRes.error) return { data: null, error: toRes.error.message }

  const toRow = toRes.data as
    | { id: string; deleted: boolean; collection_item_id: string; graded: boolean; grading: boolean }
    | null

  if (!toRow) {
    return {
      data: {
        toUserCollectionId,
        exists: false,
        deleted: true,
        collection_item_id: null,
        graded: false,
        grading: false,
        currentQty: 0,
      },
      error: null,
    }
  }

  const qtyRes = await supabase
    .from("user_collection")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("collection_item_id", toRow.collection_item_id)
    .eq("graded", toRow.graded)
    .eq("derived", false)
    .eq("deleted", false)

  if (qtyRes.error) return { data: null, error: qtyRes.error.message }

  return {
    data: {
      toUserCollectionId,
      exists: true,
      deleted: Boolean(toRow.deleted),
      collection_item_id: toRow.collection_item_id,
      graded: Boolean(toRow.graded),
      grading: Boolean(toRow.grading),
      currentQty: Number(qtyRes.count ?? 0),
    },
    error: null,
  }
}

export function collectRecoverWarnings(
  targets: DerivedTargetInfo[],
  t: TFunction
): string[] {
  const warnings: string[] = []
  let gradingCount = 0
  let missingCount = 0
  let multipleCopiesCount = 0

  for (const info of targets) {
    if (info.grading) gradingCount += 1
    else if (!info.exists || info.deleted) missingCount += 1
    else if (info.currentQty > 1) multipleCopiesCount += 1
  }

  if (gradingCount > 0) {
    warnings.push(t("dialogs.recoverDerived.warningGrading", { count: gradingCount }))
  }
  if (missingCount > 0) {
    warnings.push(t("dialogs.recoverDerived.warningMissing", { count: missingCount }))
  }
  if (multipleCopiesCount > 0) {
    warnings.push(
      t("dialogs.recoverDerived.warningMultipleCopies", { count: multipleCopiesCount })
    )
  }

  return warnings
}

export async function removeOneDerivedMapping(
  supabase: SupabaseClient,
  userId: string,
  mapping: DerivedMappingRef,
  deleteFailedMessage: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { recordId, toUserCollectionId } = mapping

  const linksRes = await supabase
    .from("user_derived_collection_miscellaneous")
    .select("miscellaneous_entries_id")
    .eq("user_id", userId)
    .eq("user_derived_collection_id", recordId)

  if (linksRes.error) return { ok: false, error: linksRes.error.message }

  const miscIds = Array.from(
    new Set(
      (linksRes.data ?? [])
        .map((r) => (r as { miscellaneous_entries_id: string | null }).miscellaneous_entries_id)
        .filter((v): v is string => Boolean(v))
    )
  )

  if (miscIds.length) {
    const delLinks = await supabase
      .from("user_derived_collection_miscellaneous")
      .delete()
      .eq("user_id", userId)
      .eq("user_derived_collection_id", recordId)
      .in("miscellaneous_entries_id", miscIds)

    if (delLinks.error) return { ok: false, error: delLinks.error.message }

    const delMisc = await supabase
      .from("miscellaneous_entries")
      .delete()
      .eq("user_id", userId)
      .in("id", miscIds)

    if (delMisc.error) return { ok: false, error: delMisc.error.message }
  }

  const toRes = await supabase
    .from("user_collection")
    .select("id, deleted, grading")
    .eq("user_id", userId)
    .eq("id", toUserCollectionId)
    .maybeSingle()

  if (toRes.error) return { ok: false, error: toRes.error.message }

  const toRow = toRes.data as { id: string; deleted: boolean; grading: boolean } | null

  const delMap = await supabase
    .from("user_derived_collection")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", recordId)

  if (delMap.error) return { ok: false, error: delMap.error.message }
  if (!delMap.count) return { ok: false, error: deleteFailedMessage }

  if (toRow && !toRow.deleted && !toRow.grading) {
    const delTo = await supabase
      .from("user_collection")
      .delete()
      .eq("user_id", userId)
      .eq("id", toUserCollectionId)

    if (delTo.error) return { ok: false, error: delTo.error.message }
  }

  return { ok: true }
}

export async function recoverDerivedSourceMappings(
  supabase: SupabaseClient,
  userId: string,
  fromUserCollectionId: string,
  mappings: DerivedMappingRef[],
  deleteFailedMessage: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const mapping of mappings) {
    const result = await removeOneDerivedMapping(
      supabase,
      userId,
      mapping,
      deleteFailedMessage
    )
    if (!result.ok) return result
  }

  const restore = await supabase
    .from("user_collection")
    .update({ derived: false })
    .eq("user_id", userId)
    .eq("id", fromUserCollectionId)
    .eq("deleted", false)

  if (restore.error) return { ok: false, error: restore.error.message }

  return { ok: true }
}
