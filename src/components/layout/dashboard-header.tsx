import { OrgSwitcher } from "./org-switcher";
import { UserNav } from "./user-nav";

interface DashboardHeaderProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <OrgSwitcher />
        <div className="flex-1" />
        <UserNav user={user} />
      </div>
    </header>
  );
}
