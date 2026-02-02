"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  Table2,
  Code2,
  MoreHorizontal,
  Trash2,
  Settings,
  Loader2,
  Database,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { api } from "~/trpc/react";
import { useOrganization } from "~/contexts/organization-context";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

function ResourceTypeBadge({ type }: { type: string }) {
  if (type === "TABLE") {
    return (
      <Badge variant="secondary">
        <Table2 className="mr-1 h-3 w-3" />
        Table
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Code2 className="mr-1 h-3 w-3" />
      Query
    </Badge>
  );
}

function ResourceCard({
  resource,
  orgSlug,
  onDelete,
}: {
  resource: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    createdAt: Date;
    dataSource: { id: string; name: string };
    createdBy: { id: string; name: string };
  };
  orgSlug: string;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {resource.type === "TABLE" ? (
              <Table2 className="h-5 w-5 text-primary" />
            ) : (
              <Code2 className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <CardTitle className="text-lg">{resource.name}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {resource.dataSource.name}
            </CardDescription>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${orgSlug}/resources/${resource.id}`)
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(resource.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <ResourceTypeBadge type={resource.type} />
          <p className="text-xs text-muted-foreground">
            Created{" "}
            {formatDistanceToNow(new Date(resource.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        {resource.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {resource.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ResourcesPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: resources,
    isLoading,
    refetch,
  } = api.resource.list.useQuery({ organizationId: organization.id });

  const deleteMutation = api.resource.delete.useMutation({
    onSuccess: () => {
      setDeleteId(null);
      void refetch();
    },
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ organizationId: organization.id, id: deleteId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground">
            Define tables and queries to use in your apps.
          </p>
        </div>
        <Button onClick={() => router.push(`/${organization.slug}/resources/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Resource
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : resources?.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Table2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No resources</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first resource to start building apps.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push(`/${organization.slug}/resources/new`)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Resource
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources?.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              orgSlug={organization.slug}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this resource? This action cannot
              be undone. Any apps using this resource will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
