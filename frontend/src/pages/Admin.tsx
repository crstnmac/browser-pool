import { Shield, Users, Camera, TrendingUp } from 'lucide-react'
import { useAdminAnalytics } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminPage() {
  const { data: analytics } = useAdminAnalytics()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System-wide analytics and management
        </p>
      </div>

      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.users.total}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.users.active} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Screenshots</CardTitle>
              <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.screenshots.total}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.screenshots.today} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Requests</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.requests.total}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.requests.today} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(analytics.requests.errorRate * 100).toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Users by Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Free</span>
                <span className="font-bold">{analytics.users.byPlan.FREE || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pro</span>
                <span className="font-bold">{analytics.users.byPlan.PRO || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Enterprise</span>
                <span className="font-bold">{analytics.users.byPlan.ENTERPRISE || 0}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
