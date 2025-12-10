import { Link } from 'react-router-dom'
import { Camera, Zap, Shield, Clock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LandingPage() {
  const features = [
    {
      icon: Camera,
      title: 'High-Quality Screenshots',
      description: 'Capture pixel-perfect screenshots of any website in multiple formats and resolutions',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Our optimized browser pool ensures quick screenshot generation with minimal latency',
    },
    {
      icon: Shield,
      title: 'Smart Cookie Handling',
      description: 'Automatically detects and handles cookie consent banners and popups',
    },
    {
      icon: Clock,
      title: 'Scheduled Screenshots',
      description: 'Set up automated screenshot capture on a schedule with cron expressions',
    },
  ]

  const plans = [
    {
      name: 'Free',
      price: 0,
      screenshots: '100',
      rateLimit: '5 req/min',
      features: ['Basic screenshots', 'Cookie handling', 'API access'],
    },
    {
      name: 'Pro',
      price: 29,
      screenshots: '5,000',
      rateLimit: '30 req/min',
      features: ['All Free features', 'Webhooks', 'Scheduled screenshots', 'Priority support'],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 199,
      screenshots: '100,000',
      rateLimit: '100 req/min',
      features: ['All Pro features', 'Admin dashboard', 'Custom integrations', '24/7 support'],
    },
  ]

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-20 items-center justify-between px-6 lg:px-8 max-w-full">
          <Link to="/" className="flex items-center gap-3">
            <Camera className="h-6 w-6 text-foreground" />
            <span className="handjet-display font-semibold text-xl tracking-tight">Browser Pool</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="h-9" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button className="h-9" asChild>
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 lg:px-8 py-32 md:py-40 max-w-full">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="instrument-serif-regular text-5xl font-normal tracking-tight sm:text-6xl md:text-7xl mb-8 text-foreground">
            Screenshot as a Service
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Capture high-quality screenshots of any website with our powerful API.
            Smart cookie handling, scheduled captures, and lightning-fast performance.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="h-11 px-8" asChild>
              <Link to="/register">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-8" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-6 lg:px-8 py-24 md:py-32 bg-muted/30 max-w-full">
        <div className="mx-auto max-w-7xl w-full">
          <h2 className="instrument-serif-regular text-4xl md:text-5xl font-normal text-center mb-16 tracking-tight">Features</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-border/40 h-full">
                  <CardHeader className="pb-4">
                    <div className="mb-4">
                      <Icon className="h-10 w-10 text-foreground" />
                    </div>
                    <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-6 lg:px-8 py-24 md:py-32 max-w-full">
        <div className="mx-auto max-w-7xl w-full">
          <h2 className="instrument-serif-regular text-4xl md:text-5xl font-normal text-center mb-16 tracking-tight">Simple Pricing</h2>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={`border-border/40 h-full flex flex-col ${plan.popular ? 'border-foreground/20 shadow-lg md:-mt-4 md:mb-4' : ''}`}>
                <CardHeader className="pb-6">
                  {plan.popular && (
                    <div className="px-3 py-1 text-sm font-medium bg-foreground text-background rounded-full w-fit mb-4">
                      Most Popular
                    </div>
                  )}
                  <CardTitle className="text-3xl font-semibold mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-lg">
                    <span className="text-5xl font-semibold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground ml-1">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-1 flex flex-col">
                  <div className="space-y-1">
                    <div className="font-medium text-base text-foreground">{plan.screenshots} screenshots/month</div>
                    <div className="text-base text-muted-foreground">{plan.rateLimit}</div>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-base text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full h-10 mt-auto" variant={plan.popular ? 'default' : 'outline'} asChild>
                    <Link to="/register">Get Started</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-16 w-full">
        <div className="container mx-auto px-6 lg:px-8 max-w-full">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex items-center gap-3">
              <Camera className="h-6 w-6 text-foreground" />
              <span className="handjet-display font-semibold text-xl">Browser Pool</span>
            </div>
            <p className="text-base text-muted-foreground">
              © 2025 Browser Pool. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
