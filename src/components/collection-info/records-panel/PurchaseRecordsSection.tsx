import { SkeletonMuted } from "@/components/collection-info/records-panel/shared"
import type { BuyEntry } from "@/components/collection-info/types"

type Props = {
  loading: boolean
  buyEntries: BuyEntry[]
  formatMoneyHKD: (n: number) => string
}

export function PurchaseRecordsSection({ loading, buyEntries, formatMoneyHKD }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-background/40 p-2">
            <div className="flex items-baseline justify-between gap-3">
              <SkeletonMuted className="h-4 w-24" />
              <SkeletonMuted className="h-4 w-20" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <SkeletonMuted className="h-3 w-10" />
                <div className="mt-1">
                  <SkeletonMuted className="h-4 w-24" />
                </div>
              </div>
              <div className="text-right">
                <SkeletonMuted className="ml-auto h-3 w-8" />
                <div className="mt-1">
                  <SkeletonMuted className="ml-auto h-4 w-10" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!buyEntries.length) return <p className="text-sm text-muted-foreground">No purchase records found.</p>

  return (
    <>
      <div className="hidden grid-cols-[140px_1fr_90px_110px] gap-3 border-b pb-2 text-xs font-medium text-muted-foreground lg:grid">
        <div>Date</div>
        <div>Price (per 1)</div>
        <div>Qty</div>
        <div className="text-right">Total</div>
      </div>

      <div className="mt-2 space-y-2">
        {buyEntries.map((b) => {
          const total = (Number(b.price_hkd) || 0) * (Number(b.quantity) || 0)
          return (
            <div key={b.id} className="rounded-xl border bg-background/40 p-2">
              <div className="grid gap-2 lg:hidden">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{b.purchase_date}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-xs">Price</span>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3">
                    <div className="min-w-0 text-foreground">
                      {formatMoneyHKD(Number(b.price_hkd))} <span className="text-muted-foreground">×</span> {b.quantity}
                    </div>
                    <div className="shrink-0 text-foreground">{formatMoneyHKD(total)}</div>
                  </div>
                </div>
              </div>

              <div className="hidden grid-cols-[140px_1fr_90px_110px] items-center gap-3 lg:grid">
                <div className="text-sm">{b.purchase_date}</div>
                <div className="text-sm">{formatMoneyHKD(Number(b.price_hkd))}</div>
                <div className="text-sm">{b.quantity}</div>
                <div className="text-right text-sm font-semibold">{formatMoneyHKD(total)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
