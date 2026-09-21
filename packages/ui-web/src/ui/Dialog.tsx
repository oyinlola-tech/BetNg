import { Modal } from "./Modal";
import type { ModalProps } from "./Modal";

export type DialogProps = ModalProps;

export const Dialog: (props: DialogProps) => React.JSX.Element | null = Modal;
