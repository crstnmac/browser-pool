import { Check, CreditCard } from 'lucide-react'
import { useSubscription, useSubscriptionPlans, useCreateCheckout, useCancelSubscription, useReactivateSubscription, usePayments } from '@/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'

export function SubscriptionPage() {
  const { data: subscription } = useSubscription()
  const { data: plans } = useSubscriptionPlans()
  const { data: payments } = usePayments()
  const createCheckoutMutation = useCreateCheckout()
  const cancelMutation = useCancelSubscription()
  const reactivateMutation = useReactivateSubscription()

  const handleUpgrade = async (planId: string) => {
    await createCheckoutMutation.mutateAsync(planId)
  }

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      await cancelMutation.mutateAsync()
    }
  }

  const handleReactivate = async () => {
    await reactivateMutation.mutateAsync()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Your active plan and billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">{subscription.plan}</h3>
                <p className="text-sm text-muted-foreground">
                  {subscription.status === 'active' ? 'Active subscription' : subscription.status}
                </p>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.status}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current period:</span>
                <span>
                  {format(new Date(subscription.currentPeriodStart), 'PP')} -{' '}
                  {format(new Date(subscription.currentPeriodEnd), 'PP')}
                </span>
              </div>
              {subscription.trialEnd && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trial ends:</span>
                  <span>{format(new Date(subscription.trialEnd), 'PP')}</span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="flex justify-between text-amber-600">
                  <span>Cancels on:</span>
                  <span>{format(new Date(subscription.currentPeriodEnd), 'PP')}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {subscription.cancelAtPeriodEnd ? (
                <Button onClick={handleReactivate} disabled={reactivateMutation.isPending}>
                  {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  {cancelMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans?.map((plan) => (
            <Card key={plan.name} className={plan.name === subscription?.plan ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle>{plan.displayName}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/{plan.interval}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {plan.features.screenshotsPerMonth.toLocaleString()} screenshots/month
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {plan.features.rateLimit} req/min
                    </span>
                  </li>
                  {plan.features.webhooks && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">Webhooks</span>
                    </li>
                  )}
                  {plan.features.scheduledScreenshots && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">Scheduled Screenshots</span>
                    </li>
                  )}
                  {plan.features.priority && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">Priority Support</span>
                    </li>
                  )}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.name === subscription?.plan ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={createCheckoutMutation.isPending}
                  >
                    {createCheckoutMutation.isPending ? 'Processing...' : 'Upgrade'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-4">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        ${payment.amount / 100} {payment.currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payment.createdAt), 'PPp')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={payment.status === 'succeeded' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'}>
                      {payment.status}
                    </Badge>
                    {payment.receiptUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                          Receipt
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
