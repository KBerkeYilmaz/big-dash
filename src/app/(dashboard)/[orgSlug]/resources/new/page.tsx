"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Loader2, Table2, Code2, ChevronDown } from "lucide-react";

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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

const tableFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  dataSourceId: z.string().min(1, "Data source is required"),
  tableName: z.string().min(1, "Table name is required"),
  columns: z.array(z.string()).min(1, "Select at least one column"),
  primaryKey: z.array(z.string()),
});

const queryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  dataSourceId: z.string().min(1, "Data source is required"),
  sql: z.string().min(1, "SQL query is required"),
});

type TableFormValues = z.infer<typeof tableFormSchema>;
type QueryFormValues = z.infer<typeof queryFormSchema>;

export default function NewResourcePage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [resourceType, setResourceType] = useState<"TABLE" | "QUERY">("TABLE");
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>("");
  const [selectedTableName, setSelectedTableName] = useState<string>("");
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);

  const { data: dataSources, isLoading: isLoadingDataSources } =
    api.dataSource.list.useQuery({ organizationId: organization.id });

  const { data: schema, isLoading: isLoadingSchema } =
    api.dataSource.introspectSchema.useQuery(
      { organizationId: organization.id, id: selectedDataSourceId },
      { enabled: !!selectedDataSourceId }
    );

  const tableForm = useForm<TableFormValues>({
    resolver: zodResolver(tableFormSchema),
    defaultValues: {
      name: "",
      description: "",
      dataSourceId: "",
      tableName: "",
      columns: [],
      primaryKey: [],
    },
  });

  const queryForm = useForm<QueryFormValues>({
    resolver: zodResolver(queryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      dataSourceId: "",
      sql: "",
    },
  });

  const createTableMutation = api.resource.createTable.useMutation({
    onSuccess: () => {
      router.push(`/${organization.slug}/resources`);
    },
  });

  const createQueryMutation = api.resource.createQuery.useMutation({
    onSuccess: () => {
      router.push(`/${organization.slug}/resources`);
    },
  });

  const selectedTable = schema?.tables.find((t) => t.name === selectedTableName);

  const onTableSubmit = (values: TableFormValues) => {
    createTableMutation.mutate({
      organizationId: organization.id,
      name: values.name,
      description: values.description,
      dataSourceId: values.dataSourceId,
      config: {
        tableName: values.tableName,
        columns: values.columns,
        primaryKey: values.primaryKey,
      },
    });
  };

  const onQuerySubmit = (values: QueryFormValues) => {
    createQueryMutation.mutate({
      organizationId: organization.id,
      name: values.name,
      description: values.description,
      dataSourceId: values.dataSourceId,
      config: {
        sql: values.sql,
      },
    });
  };

  const connectedDataSources = dataSources?.filter(
    (ds) => ds.status === "CONNECTED"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${organization.slug}/resources`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Resource</h1>
          <p className="text-muted-foreground">
            Create a table or query resource.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        <Card
          className={cn(
            "cursor-pointer transition-colors hover:border-primary",
            resourceType === "TABLE" && "border-primary bg-primary/5"
          )}
          onClick={() => setResourceType("TABLE")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Table2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Table</CardTitle>
                <CardDescription>CRUD operations on a table</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-colors hover:border-primary",
            resourceType === "QUERY" && "border-primary bg-primary/5"
          )}
          onClick={() => setResourceType("QUERY")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Code2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Query</CardTitle>
                <CardDescription>Custom SQL query</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {resourceType === "TABLE" ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Table Resource</CardTitle>
            <CardDescription>
              Select a table from your data source to enable CRUD operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...tableForm}>
              <form
                onSubmit={tableForm.handleSubmit(onTableSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={tableForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resource Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Users Table" {...field} />
                      </FormControl>
                      <FormDescription>
                        A friendly name for this resource.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tableForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What is this resource used for?"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tableForm.control}
                  name="dataSourceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Source</FormLabel>
                      {isLoadingDataSources ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedDataSourceId(value);
                            setSelectedTableName("");
                            tableForm.setValue("tableName", "");
                            tableForm.setValue("columns", []);
                            tableForm.setValue("primaryKey", []);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a data source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {connectedDataSources?.map((ds) => (
                              <SelectItem key={ds.id} value={ds.id}>
                                {ds.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {connectedDataSources?.length === 0 && (
                        <FormDescription className="text-destructive">
                          No connected data sources. Please add and test a
                          connection first.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedDataSourceId && (
                  <FormField
                    control={tableForm.control}
                    name="tableName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Table</FormLabel>
                        {isLoadingSchema ? (
                          <Skeleton className="h-10 w-full" />
                        ) : (
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedTableName(value);
                              setIsColumnsOpen(true);
                              const table = schema?.tables.find(
                                (t) => t.name === value
                              );
                              if (table) {
                                tableForm.setValue(
                                  "columns",
                                  table.columns.map((c) => c.name)
                                );
                                tableForm.setValue("primaryKey", table.primaryKey);
                              }
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a table" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schema?.tables.map((table) => (
                                <SelectItem key={table.name} value={table.name}>
                                  {table.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedTable && (
                  <Collapsible open={isColumnsOpen} onOpenChange={setIsColumnsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex w-full justify-between p-0 h-auto font-medium"
                      >
                        Columns ({tableForm.watch("columns").length} selected)
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isColumnsOpen && "rotate-180"
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <FormField
                        control={tableForm.control}
                        name="columns"
                        render={() => (
                          <FormItem>
                            <div className="space-y-2">
                              {selectedTable.columns.map((column) => (
                                <FormField
                                  key={column.name}
                                  control={tableForm.control}
                                  name="columns"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(
                                            column.name
                                          )}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            if (checked) {
                                              field.onChange([
                                                ...current,
                                                column.name,
                                              ]);
                                            } else {
                                              field.onChange(
                                                current.filter(
                                                  (v) => v !== column.name
                                                )
                                              );
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal flex items-center gap-2">
                                        <span>{column.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {column.type}
                                          {column.nullable ? "" : " NOT NULL"}
                                          {selectedTable.primaryKey.includes(
                                            column.name
                                          ) && " (PK)"}
                                        </span>
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/${organization.slug}/resources`)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createTableMutation.isPending}
                  >
                    {createTableMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Resource"
                    )}
                  </Button>
                </div>

                {createTableMutation.error && (
                  <p className="text-sm text-destructive">
                    {createTableMutation.error.message}
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Query Resource</CardTitle>
            <CardDescription>
              Write a custom SQL query. Use parameterized queries for safety.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...queryForm}>
              <form
                onSubmit={queryForm.handleSubmit(onQuerySubmit)}
                className="space-y-6"
              >
                <FormField
                  control={queryForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resource Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Active Users Query" {...field} />
                      </FormControl>
                      <FormDescription>
                        A friendly name for this resource.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={queryForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What is this resource used for?"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={queryForm.control}
                  name="dataSourceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Source</FormLabel>
                      {isLoadingDataSources ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a data source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {connectedDataSources?.map((ds) => (
                              <SelectItem key={ds.id} value={ds.id}>
                                {ds.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {connectedDataSources?.length === 0 && (
                        <FormDescription className="text-destructive">
                          No connected data sources. Please add and test a
                          connection first.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={queryForm.control}
                  name="sql"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SQL Query</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="SELECT * FROM users WHERE active = true"
                          className="font-mono min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Write a SELECT query. Dangerous statements (DROP,
                        TRUNCATE, etc.) are not allowed.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/${organization.slug}/resources`)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createQueryMutation.isPending}
                  >
                    {createQueryMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Resource"
                    )}
                  </Button>
                </div>

                {createQueryMutation.error && (
                  <p className="text-sm text-destructive">
                    {createQueryMutation.error.message}
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
