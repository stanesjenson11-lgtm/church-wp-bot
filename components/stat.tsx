import { Card, CardContent } from "@/components/ui/card";

/**
 * One headline figure with its label. `danger` shows the figure in red;
 * `hint` is a line under it, such as the change since last month.
 */
export function Stat({
  label,
  value,
  danger = false,
  hint,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`text-3xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
