"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

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
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  ssl: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewDataSourcePage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      host: "localhost",
      port: 5432,
      database: "",
      username: "",
      password: "",
      ssl: false,
    },
  });

  const testMutation = api.dataSource.testConnectionPreview.useMutation({
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message });
    },
  });

  const createMutation = api.dataSource.create.useMutation({
    onSuccess: () => {
      router.push(`/${organization.slug}/data-sources`);
    },
  });

  const handleTestConnection = () => {
    const values = form.getValues();
    setTestResult(null);
    testMutation.mutate({
      organizationId: organization.id,
      type: "POSTGRESQL",
      config: {
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
        password: values.password,
        ssl: values.ssl,
      },
    });
  };

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      organizationId: organization.id,
      name: values.name,
      type: "POSTGRESQL",
      config: {
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
        password: values.password,
        ssl: values.ssl,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${organization.slug}/data-sources`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Data Source</h1>
          <p className="text-muted-foreground">
            Connect to a PostgreSQL database
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>PostgreSQL</CardTitle>
                <CardDescription>
                  Connect to a PostgreSQL database server
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Production Database" {...field} />
                      </FormControl>
                      <FormDescription>
                        A friendly name to identify this data source
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Host</FormLabel>
                        <FormControl>
                          <Input placeholder="localhost" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5432" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="database"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Database</FormLabel>
                      <FormControl>
                        <Input placeholder="mydb" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="postgres" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ssl"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">SSL Connection</FormLabel>
                        <FormDescription>
                          Enable SSL/TLS encryption for the connection
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {testResult.success ? "Connection Successful" : "Connection Failed"}
                    </AlertTitle>
                    <AlertDescription>
                      {testResult.success
                        ? `Connected in ${testResult.latencyMs}ms`
                        : testResult.error}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Data Source"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                <strong>Host:</strong> Use the IP address or hostname of your
                database server. For local development, use{" "}
                <code className="rounded bg-muted px-1">localhost</code>.
              </p>
              <p>
                <strong>Port:</strong> The default PostgreSQL port is 5432.
              </p>
              <p>
                <strong>SSL:</strong> Enable SSL for production databases,
                especially when connecting over the internet.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                Your credentials are encrypted at rest using AES-256-GCM
                encryption and are never logged or exposed.
              </p>
              <p>
                We recommend creating a dedicated database user with limited
                permissions for this connection.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
