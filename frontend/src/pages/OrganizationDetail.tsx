import { useParams, Link } from 'react-router-dom'
import { Building2, Users, Mail, UserPlus, ArrowLeft, MoreHorizontal, Crown, User } from 'lucide-react'
import { useOrganization, useInviteUser, useCancelInvitation, useRemoveMember, useUpdateMemberRole } from '@/hooks/use-organization'
import { useSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InviteUserDialog } from '@/components/InviteUserDialog'
import { toast } from 'sonner'
import { useState } from 'react'

export function OrganizationDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: session } = useSession()
  const { data: organizationData, isLoading, error } = useOrganization(slug!)
  const inviteUserMutation = useInviteUser()
  const cancelInvitationMutation = useCancelInvitation()
  const removeMemberMutation = useRemoveMember()
  const updateMemberRoleMutation = useUpdateMemberRole()

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null)

  if (!slug) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <p className="text-destructive">Invalid organization</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading organization...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !organizationData) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive">Failed to load organization</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error?.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const organization = organizationData.organization
  const currentUserMembership = organization.members.find(m => m.userId === session?.user?.id)
  const isAdmin = currentUserMembership?.role === 'admin'
  const isCurrentUser = (userId: string) => userId === session?.user?.id

  const handleInviteUser = async (data: { email: string; role: 'member' | 'admin' }) => {
    try {
      await inviteUserMutation.mutateAsync({ slug, data })
      toast.success('Invitation sent successfully!')
      setShowInviteDialog(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitationMutation.mutateAsync({ slug, invitationId })
      toast.success('Invitation cancelled')
      setInvitationToCancel(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMemberMutation.mutateAsync({ slug, memberId })
      toast.success('Member removed successfully')
      setMemberToRemove(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member')
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: 'member' | 'admin') => {
    try {
      await updateMemberRoleMutation.mutateAsync({
        slug,
        memberId,
        data: { role: newRole }
      })
      toast.success('Member role updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update member role')
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link to="/organizations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizations
          </Button>
        </Link>
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
            <p className="text-muted-foreground">{organization.slug}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Members Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Members ({organization.members.length})</span>
                </CardTitle>
                <CardDescription>
                  Manage organization members and their roles
                </CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => setShowInviteDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {organization.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{member.user.name}</p>
                          {isCurrentUser(member.userId) && (
                            <Badge variant="outline">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                        {member.role === 'admin' ? (
                          <>
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            Member
                          </>
                        )}
                      </Badge>
                      {isAdmin && !isCurrentUser(member.userId) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleUpdateMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                              disabled={updateMemberRoleMutation.isPending}
                            >
                              {member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setMemberToRemove(member.id)}
                              className="text-destructive"
                            >
                              Remove from Organization
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Invitations */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Pending Invitations ({organization.invitations.length})</span>
              </CardTitle>
              <CardDescription>
                Users who have been invited but haven't accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {organization.invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending invitations
                </p>
              ) : (
                <div className="space-y-3">
                  {organization.invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {new Date(invitation.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {invitation.role}
                        </Badge>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInvitationToCancel(invitation.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onInvite={handleInviteUser}
        isLoading={inviteUserMutation.isPending}
      />

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the organization?
              They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Dialog */}
      <AlertDialog open={!!invitationToCancel} onOpenChange={() => setInvitationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invitation? The user will not be able to join the organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToCancel && handleCancelInvitation(invitationToCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
