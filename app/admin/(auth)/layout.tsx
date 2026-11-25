import { Church } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="squircle grid size-14 place-items-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--primary)]">
            <Church className="size-7" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Church</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
