import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { useSession, updateUser, changePassword } from '@/lib/auth'
import { useOrganizations, useOrganizationSwitcher, useActiveOrganization } from '@/hooks/use-organization'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Building2, Users, Check } from 'lucide-react'

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

export function SettingsPage() {
  const { data: session } = useSession()
  const user = session?.user
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isLoadingPassword, setIsLoadingPassword] = useState(false)

  // Organization hooks
  const { data: organizationsData } = useOrganizations()
  const { switchOrganization, isSwitching } = useOrganizationSwitcher()
  const activeOrganization = useActiveOrganization()
  const organizations = organizationsData?.organizations || []

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name || '',
      email: user?.email || '',
    },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || '',
        email: user.email || '',
      })
    }
  }, [user, profileForm])

  const handleSwitchOrganization = async (organizationId: string | null) => {
    try {
      await switchOrganization(organizationId)
      toast.success('Organization switched successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to switch organization')
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsLoadingProfile(true)
    try {
      await updateUser({
        name: data.name,
      })

      // Email changes require additional verification in better-auth
      // They are handled separately and will trigger a verification email
      if (data.email !== user?.email) {
        toast.info('Email change will require verification. Check your email for instructions.')
      } else {
        toast.success('Profile updated successfully')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      toast.error(errorMessage)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsLoadingPassword(true)
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success('Password updated successfully')
      passwordForm.reset()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password'
      toast.error(errorMessage)
    } finally {
      setIsLoadingPassword(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="instrument-serif-regular text-4xl md:text-5xl font-normal tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-lg">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">Profile Information</CardTitle>
              <CardDescription className="text-base">
                Update your account profile information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...profileForm.register('name')} />
                  {profileForm.formState.errors.name && (
                    <p className="text-base text-destructive">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...profileForm.register('email')} />
                  {profileForm.formState.errors.email && (
                    <p className="text-base text-destructive">
                      {profileForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isLoadingProfile} className="h-10">
                  {isLoadingProfile ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">Change Password</CardTitle>
              <CardDescription className="text-base">
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...passwordForm.register('currentPassword')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...passwordForm.register('newPassword')}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-base text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register('confirmPassword')}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-base text-destructive">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isLoadingPassword} className="h-10">
                  {isLoadingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizations">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">Organization Settings</CardTitle>
              <CardDescription className="text-base">
                Manage your organizations and switch between them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Active Organization */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Active Organization</h3>
                {activeOrganization ? (
                  <div className="flex items-center space-x-3 p-4 border rounded-lg bg-accent/50">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm font-medium">
                        <Building2 className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{(activeOrganization as any).name}</p>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{(activeOrganization as any).slug}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm font-medium">
                        <Building2 className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Personal Account</p>
                      <p className="text-sm text-muted-foreground">No organization selected</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Organization List */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Your Organizations</h3>
                {organizations.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">You haven't joined any organizations yet.</p>
                    <Button asChild>
                      <a href="/organizations">Create or Join Organization</a>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {organizations.map((org: any) => (
                      <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm font-medium">
                              <Building2 className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{org.name}</p>
                              {(activeOrganization as any)?.id === org.id && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>{org.slug}</span>
                              <span>•</span>
                              <div className="flex items-center space-x-1">
                                <Users className="h-3 w-3" />
                                <span>{org._count?.members || 0} members</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {org.members.find((m: any) => m.userId === user?.id)?.role === 'admin' ? 'Admin' : 'Member'}
                          </Badge>
                          {(activeOrganization as any)?.id !== org.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSwitchOrganization(org.id)}
                              disabled={isSwitching}
                            >
                              {isSwitching ? 'Switching...' : 'Switch To'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Personal Account Option */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm font-medium">
                            {getInitials(user?.name || user?.email || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">Personal Account</p>
                            {!activeOrganization && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Work independently</p>
                        </div>
                      </div>
                      {activeOrganization && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitchOrganization(null)}
                          disabled={isSwitching}
                        >
                          {isSwitching ? 'Switching...' : 'Switch To'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
