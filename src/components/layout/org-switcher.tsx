"use client";

import { useRouter, useParams } from "next/navigation";
import { ChevronsUpDown, Plus, Building2 } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";

export function OrgSwitcher() {
  const router = useRouter();
  const params = useParams();
  const currentSlug = params.orgSlug as string | undefined;

  const { data: orgs, isLoading } = api.organization.list.useQuery();

  const currentOrg = orgs?.find((org) => org.slug === currentSlug);

  if (isLoading) {
    return <Skeleton className="h-10 w-[200px]" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {currentOrg?.name ?? "Select organization"}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs?.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => router.push(`/${org.slug}`)}
            className={org.slug === currentSlug ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        {orgs?.length === 0 && (
          <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
