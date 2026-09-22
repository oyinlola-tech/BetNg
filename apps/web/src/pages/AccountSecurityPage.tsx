import { ShieldCheck } from "lucide-react";
import { PasswordChangeCard } from "../features/account/security/PasswordChangeCard";
import { TwoFactorSection } from "../features/account/security/TwoFactorSection";
import { useAuth } from "../features/auth";
import { usePageMeta } from "../features/seo";

export function AccountSecurityPage(): React.JSX.Element {
  usePageMeta({ title: "Security", noindex: true });

  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <PasswordChangeCard email={user?.email} />
      <TwoFactorSection />
      <p className="type-small flex items-start gap-2 text-text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        BETNG never stores your password, codes or keys in this browser.
      </p>
    </div>
  );
}
