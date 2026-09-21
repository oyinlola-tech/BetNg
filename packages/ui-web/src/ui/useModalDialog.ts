import { useEffect, useRef } from "react";

export interface ModalDialogBindings {
  readonly ref: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
  readonly onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => void;
  readonly onClick: (event: React.MouseEvent<HTMLDialogElement>) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLDialogElement>) => void;
}

const FIELD =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * `showModal()` focuses the first focusable element, usually the close
 * button, and React's `autoFocus` cannot help because nothing in a closed
 * dialog can take focus. So a marked element wins, then the first field.
 */
function initialFocus(dialog: HTMLDialogElement): HTMLElement | null {
  return (
    dialog.querySelector<HTMLElement>("[data-autofocus]") ??
    dialog.querySelector<HTMLElement>(FIELD)
  );
}

/** Drives a native modal dialog: opens it in the top layer, returns focus to the opener, and routes Escape and backdrop clicks through `dismissible`. */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
  dismissible = true,
): ModalDialogBindings {
  const ref = useRef<HTMLDialogElement>(null);
  const live = useRef({ open, onClose, dismissible });
  const selfClosing = useRef(0);

  live.current = { open, onClose, dismissible };

  useEffect(() => {
    if (!open) return;

    const dialog = ref.current;

    if (dialog === null) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;

    if (!dialog.open) {
      dialog.showModal();
      initialFocus(dialog)?.focus();
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;

      // A close this cleanup causes (on unmount, or StrictMode's rehearsal) is not the user closing the dialog.
      if (dialog.open) {
        selfClosing.current += 1;
        dialog.close();
      }
      if (opener?.isConnected === true) opener.focus();
    };
  }, [open]);

  const requestClose = (): void => {
    if (live.current.open && live.current.dismissible) live.current.onClose();
  };

  return {
    ref,
    onClose: () => {
      if (selfClosing.current > 0) {
        selfClosing.current -= 1;

        return;
      }

      if (live.current.open) live.current.onClose();
    },
    onCancel: (event) => {
      event.preventDefault();
      requestClose();
    },
    onClick: (event) => {
      if (event.target === ref.current) requestClose();
    },
    onKeyDown: (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      event.preventDefault();
      requestClose();
    },
  };
}
