export interface AppLayoutProps {
  readonly children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <div>
      <header>
        <h1>BetNG</h1>
        <p>Virtual football</p>
      </header>
      <main>{children}</main>
    </div>
  );
}
