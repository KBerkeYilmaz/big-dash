import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Database, Layers, AppWindow, Users } from "lucide-react";

interface OrgDashboardProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgDashboard({ params }: OrgDashboardProps) {
  const { orgSlug } = await params;

  // Auth is already handled by the parent layout
  // This query is safe since the layout already verified membership
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      _count: {
        select: {
          members: true,
          dataSources: true,
          resources: true,
          apps: true,
        },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const stats = [
    {
      title: "Data Sources",
      value: org._count.dataSources,
      icon: Database,
      href: `/${orgSlug}/data-sources`,
    },
    {
      title: "Resources",
      value: org._count.resources,
      icon: Layers,
      href: `/${orgSlug}/resources`,
    },
    {
      title: "Apps",
      value: org._count.apps,
      icon: AppWindow,
      href: `/${orgSlug}/apps`,
    },
    {
      title: "Members",
      value: org._count.members,
      icon: Users,
      href: `/${orgSlug}/settings/members`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{org.name}</h1>
        <p className="text-muted-foreground">
          Welcome to your organization dashboard
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Connect a data source (PostgreSQL database)</p>
            <p>2. Create resources from your tables</p>
            <p>3. Build apps with table views and forms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>No recent activity</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
