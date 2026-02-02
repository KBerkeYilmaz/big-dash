"use client";

import { createContext, useContext } from "react";
import type { Role } from "@prisma/client";

interface OrganizationContextValue {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  memberRole: Role;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({
  children,
  organization,
  memberRole,
}: {
  children: React.ReactNode;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  memberRole: Role;
}) {
  return (
    <OrganizationContext.Provider value={{ organization, memberRole }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}
