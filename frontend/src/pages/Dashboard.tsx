import { Camera, TrendingUp, Zap, Clock } from 'lucide-react'
import { useUser, useUsage, useScreenshots } from '@/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

export function DashboardPage() {
  const { data: user } = useUser()
  const { data: usage } = useUsage()
  const { data: screenshots } = useScreenshots(1, 5)
  const navigate = useNavigate()

  const usagePercentage = usage?.currentPeriod
    ? (usage.currentPeriod.screenshotsUsed / usage.currentPeriod.screenshotsLimit) * 100
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || 'User'}!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.plan}</div>
            <p className="text-xs text-muted-foreground">
              {user?.subscriptionStatus || 'Active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Screenshots Used</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage?.currentPeriod?.screenshotsUsed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {usage?.currentPeriod?.screenshotsLimit || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage?.total?.totalApiCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resets In</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage?.currentPeriod?.resetDate
                ? format(new Date(usage.currentPeriod.resetDate), 'd')
                : '30'}
            </div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Usage</CardTitle>
          <CardDescription>
            Your screenshot quota for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {usage?.currentPeriod?.screenshotsUsed || 0} / {usage?.currentPeriod?.screenshotsLimit || 0} screenshots
            </span>
            <span className="text-muted-foreground">
              {usagePercentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          {usagePercentage > 80 && (
            <p className="text-sm text-amber-600">
              You're running low on screenshots. Consider upgrading your plan.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Screenshots */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Screenshots</CardTitle>
              <CardDescription>Your latest captured screenshots</CardDescription>
            </div>
            <Button onClick={() => navigate('/screenshots')}>View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          {screenshots && screenshots.screenshots.length > 0 ? (
            <div className="space-y-4">
              {screenshots.screenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className="flex items-center justify-between border rounded-lg p-4 hover:bg-accent cursor-pointer"
                  onClick={() => navigate(`/screenshots/${screenshot.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={screenshot.url}
                      alt="Screenshot"
                      className="h-16 w-24 object-cover rounded"
                    />
                    <div>
                      <p className="font-medium">{screenshot.fullUrl}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {screenshot.width}x{screenshot.height}
                        </Badge>
                        <Badge variant="secondary">{screenshot.format}</Badge>
                        {screenshot.cookiesHandled && (
                          <Badge variant="outline">Cookies handled</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(screenshot.createdAt), 'PPp')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No screenshots yet</h3>
              <p className="text-muted-foreground mt-2">
                Get started by capturing your first screenshot
              </p>
              <Button className="mt-4" onClick={() => navigate('/screenshots')}>
                Create Screenshot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
