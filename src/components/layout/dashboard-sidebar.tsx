"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Database,
  LayoutDashboard,
  Layers,
  AppWindow,
  Settings,
  FileText,
} from "lucide-react";

import { cn } from "~/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    href: "",
    icon: LayoutDashboard,
  },
  {
    title: "Data Sources",
    href: "/data-sources",
    icon: Database,
  },
  {
    title: "Resources",
    href: "/resources",
    icon: Layers,
  },
  {
    title: "Apps",
    href: "/apps",
    icon: AppWindow,
  },
  {
    title: "Audit Logs",
    href: "/audit",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function DashboardSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = params.orgSlug as string;

  return (
    <aside className="fixed left-0 top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-56 border-r bg-background md:block">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const href = `/${orgSlug}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === `/${orgSlug}`
              : pathname.startsWith(href);

          return (
            <Link
              key={item.title}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
