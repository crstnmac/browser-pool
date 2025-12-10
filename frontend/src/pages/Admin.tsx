import { Shield, Users, Camera, TrendingUp } from 'lucide-react'
import { useAdminAnalytics } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminPage() {
  const { data: analytics } = useAdminAnalytics()

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="instrument-serif-regular text-3xl md:text-4xl font-normal tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground text-base">
          System-wide analytics and management
        </p>
      </div>

      {analytics && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{analytics.users.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.users.active} active
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Screenshots</CardTitle>
              <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{analytics.screenshots.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.screenshots.today} today
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">API Requests</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{analytics.requests.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.requests.today} today
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Error Rate</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{(analytics.requests.errorRate * 100).toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Users by Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Free</span>
                <span className="font-semibold text-foreground">{analytics.users.byPlan.FREE || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Pro</span>
                <span className="font-semibold text-foreground">{analytics.users.byPlan.PRO || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Enterprise</span>
                <span className="font-semibold text-foreground">{analytics.users.byPlan.ENTERPRISE || 0}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
