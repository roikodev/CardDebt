import { PASSWORD_POLICY_BULLETS } from "@/lib/passwordPolicy"
import { cn } from "@/lib/utils"

type PasswordPolicyHintProps = {
  id?: string
  className?: string
}

export function PasswordPolicyHint({ id, className }: PasswordPolicyHintProps) {
  return (
    <div
      id={id}
      className={cn(
        "mt-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground",
        className
      )}
    >
      <p className="font-medium text-foreground/90">Your password must have:</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
        {PASSWORD_POLICY_BULLETS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
