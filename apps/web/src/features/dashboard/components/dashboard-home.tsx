/**
 * Dashboard Home Component
 *
 * Homepage content with statistics and quick links.
 *
 * @module components/dashboard/dashboard-home
 */

import { Link } from "@tanstack/react-router";
import { ArrowRight, Settings, Users, Workflow } from "lucide-react";

import { PageHeader } from "@/features/dashboard/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

import { StatsCard } from "./stats-card";

// Mock data for statistics
const mockStats = {
  totalJourneys: 5,
  activeUsers: 127,
  sessionsToday: 43,
  completionRate: 68,
};

const quickLinks = [
  {
    title: "Journey Builder",
    description: "Create and edit journey flows",
    icon: Workflow,
    href: "/journeys",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "Users",
    description: "View user sessions and activity",
    icon: Users,
    href: "/users",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    title: "Settings",
    description: "Configure your account",
    icon: Settings,
    href: "/settings",
    color: "bg-amber-500/10 text-amber-600",
  },
];

export function DashboardHome() {
  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <PageHeader title="Dashboard" description="Here's an overview of your journey builder activity." />

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Journeys" value={mockStats.totalJourneys} icon={Workflow} description="Active journeys" />
            <StatsCard title="Active Users" value={mockStats.activeUsers} icon={Users} trend={{ value: 12, isPositive: true }} description="from last week" />
            <StatsCard title="Sessions Today" value={mockStats.sessionsToday} icon={Users} trend={{ value: 8, isPositive: true }} description="from yesterday" />
            <StatsCard
              title="Completion Rate"
              value={`${mockStats.completionRate}%`}
              icon={Workflow}
              trend={{ value: 3, isPositive: false }}
              description="from last month"
            />
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Access</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {quickLinks.map((link) => (
                <Card key={link.href} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${link.color} mb-2`}>
                      <link.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button variant="ghost" className="w-full justify-between group-hover:bg-muted" asChild>
                      <Link to={link.href}>
                        Open
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

