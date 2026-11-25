"use client";

import { Drawer } from "@base-ui/react/drawer";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DialogState = { close: () => void; inDialog: boolean };

const FormDialogContext = createContext<DialogState>({
  close: () => {},
  inDialog: false,
});

/**
 * How a form dismisses the dialog it is inside.
 *
 * Context rather than a prop, because the form arrives as `children` from a
 * Server Component and a callback cannot make that trip — functions are not
 * serialisable across the boundary, only elements are. The form is itself a
 * Client Component, so it renders inside this provider and reads the value
 * normally.
 *
 * `inDialog` is false when a form is rendered as a page instead, which is how
 * the same components serve the receptionist's standalone flow.
 */
export function useFormDialog(): DialogState {
  return useContext(FormDialogContext);
}

/**
 * The same contract as FormDialog, for a dialog opened from elsewhere — a row
 * menu, say, which needs to control `open` itself and so cannot use the
 * trigger-owning version above.
 */
export function FormDialogProvider({
  close,
  children,
}: {
  close: () => void;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ close, inDialog: true }), [close]);
  return <FormDialogContext.Provider value={value}>{children}</FormDialogContext.Provider>;
}

/**
 * A form behind a button: a centred dialog from a tablet up, and on a phone a
 * bottom sheet that rises from under the thumb and swipes down to close.
 *
 * `openParam` lets a link open it from anywhere — the ⌘K palette, an empty
 * state's button, the dashboard — as `?add=1`. Closing strips the flag with
 * history.replaceState, which Next keeps in step with useSearchParams without
 * a round-trip, so the same link works again next time.
 */
export function FormDialog({
  trigger,
  title,
  description,
  wide = false,
  variant,
  size,
  openParam,
  children,
}: {
  trigger: string;
  title: string;
  description?: string;
  /** For forms with three columns of fields rather than two. */
  wide?: boolean;
  /** The trigger button's look, for a dialog opened from a table row. */
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** A search param that opens this dialog when it is "1", e.g. "add" for `?add=1`. */
  openParam?: string;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const fromUrl = !!openParam && params.get(openParam) === "1";
  const [opened, setOpened] = useState(false);
  const phone = useMediaQuery("(max-width: 767px)", {});

  const change = useCallback(
    (next: boolean) => {
      setOpened(next);
      if (!next && openParam && new URLSearchParams(location.search).has(openParam)) {
        const rest = new URLSearchParams(location.search);
        rest.delete(openParam);
        window.history.replaceState(null, "", `${location.pathname}${rest.size ? `?${rest}` : ""}`);
      }
    },
    [openParam],
  );
  const close = useCallback(() => change(false), [change]);
  const open = opened || fromUrl;
  const button = (
    <Button variant={variant} size={size}>
      {trigger}
    </Button>
  );
  const body = (
    <FormDialogContext.Provider value={{ close, inDialog: true }}>
      <div className="py-2">{children}</div>
    </FormDialogContext.Provider>
  );

  if (phone) {
    return (
      <Drawer.Root open={open} onOpenChange={change} swipeDirection="down">
        <Drawer.Trigger render={button} />
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-50 bg-black opacity-[calc(0.35*(1-var(--drawer-swipe-progress,0)))] transition-opacity duration-[450ms] ease-drawer data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0" />
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
              <Drawer.Popup className="squircle flex max-h-[92dvh] w-full touch-none flex-col rounded-t-[28px] bg-popover text-popover-foreground shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.3)] outline-none [transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-[450ms] ease-drawer data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none data-swiping:duration-0">
                {/* The grab handle and title: the part you pull down to dismiss. */}
                <div className="shrink-0 px-5 pt-2.5 pb-2 select-none">
                  <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/15" />
                  <Drawer.Title className="font-heading text-lg font-semibold tracking-[-0.01em]">{title}</Drawer.Title>
                  {description && (
                    <Drawer.Description className="text-[13px] text-muted-foreground">{description}</Drawer.Description>
                  )}
                </div>
                <Drawer.Content className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                  {body}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger render={button} />
      <DialogContent
        className={[
          "max-h-[85vh] overflow-y-auto",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl",
        ].join(" ")}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
