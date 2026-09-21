import { useEffect, useRef } from "react";

export interface ModalDialogBindings {
  readonly ref: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
  readonly onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => void;
  readonly onClick: (event: React.MouseEvent<HTMLDialogElement>) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLDialogElement>) => void;
}

/** Drives a native modal dialog: opens it in the top layer, returns focus to the opener, and routes Escape and backdrop clicks through `dismissible`. */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
  dismissible = true,
): ModalDialogBindings {
  const ref = useRef<HTMLDialogElement>(null);
  const live = useRef({ open, onClose, dismissible });

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

    if (!dialog.open) dialog.showModal();

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;

      if (dialog.open) dialog.close();
      if (opener?.isConnected === true) opener.focus();
    };
  }, [open]);

  const requestClose = (): void => {
    if (live.current.open && live.current.dismissible) live.current.onClose();
  };

  return {
    ref,
    onClose: () => {
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
