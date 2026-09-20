/**
 * The frame the broadcast sits in.
 *
 * Full-bleed and dark, because a TV is viewed from across a room rather
 * than at arm's length.
 */

export interface BroadcastLayoutProps {
  readonly children: React.ReactNode;
}

export function BroadcastLayout({
  children,
}: BroadcastLayoutProps): React.JSX.Element {
  return <div className="broadcast-shell">{children}</div>;
}
