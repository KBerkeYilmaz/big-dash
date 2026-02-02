"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  Trash2,
  Settings,
  Loader2,
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "CONNECTED":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Connected
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
  }
}

function DataSourceCard({
  dataSource,
  orgSlug,
  onDelete,
  onTest,
  isTesting,
}: {
  dataSource: {
    id: string;
    name: string;
    type: string;
    status: string;
    lastTestedAt: Date | null;
    createdBy: { id: string; name: string };
  };
  orgSlug: string;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  isTesting: boolean;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{dataSource.name}</CardTitle>
            <CardDescription>{dataSource.type}</CardDescription>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onTest(dataSource.id)} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${orgSlug}/data-sources/${dataSource.id}`)
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(dataSource.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <StatusBadge status={dataSource.status} />
          <p className="text-xs text-muted-foreground">
            {dataSource.lastTestedAt
              ? `Tested ${formatDistanceToNow(dataSource.lastTestedAt, { addSuffix: true })}`
              : "Never tested"}
          </p>
        </div>
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

export default function DataSourcesPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: dataSources, isLoading, refetch } = api.dataSource.list.useQuery({
    organizationId: organization.id,
  });

  const testMutation = api.dataSource.testConnection.useMutation({
    onSuccess: () => {
      setTestingId(null);
      void refetch();
    },
    onError: () => {
      setTestingId(null);
    },
  });

  const deleteMutation = api.dataSource.delete.useMutation({
    onSuccess: () => {
      setDeleteId(null);
      void refetch();
    },
  });

  const handleTest = (id: string) => {
    setTestingId(id);
    testMutation.mutate({ organizationId: organization.id, id });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ organizationId: organization.id, id: deleteId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
          <p className="text-muted-foreground">
            Connect to external databases to build tools and dashboards.
          </p>
        </div>
        <Button onClick={() => router.push(`/${organization.slug}/data-sources/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Data Source
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : dataSources?.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No data sources</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started by connecting your first database.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push(`/${organization.slug}/data-sources/new`)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Data Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dataSources?.map((ds) => (
            <DataSourceCard
              key={ds.id}
              dataSource={ds}
              orgSlug={organization.slug}
              onDelete={setDeleteId}
              onTest={handleTest}
              isTesting={testingId === ds.id}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this data source? This action
              cannot be undone. All resources using this data source will also
              be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
