"use client";

import { useEffect, useState } from "react";
import {
  organization,
  useActiveOrganization,
  useListOrganizations,
  useSession,
} from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/reui/alert";
import { PageHeader } from "@/components/page-header";
import {
  OrganizationMembersDataGrid,
  type OrganizationMember,
} from "@/components/organization-members-data-grid";
import {
  describeRole,
  type OrganizationRole,
} from "@/modules/organization/member-management";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Users,
  Mail,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export function OrganizationsClient() {
  const { data: activeOrg } = useActiveOrganization();
  const {
    data: orgList,
    isPending: isListLoading,
    error: listError,
    refetch: refetchList,
  } = useListOrganizations();
  const { data: session } = useSession();

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Real member & invitation data for the active organization
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Row awaiting a server response, so only that row's actions are disabled.
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);

  const activeMemberCount = members.filter((m) => m.status === "active").length;
  const invitedMemberCount = members.filter((m) => m.status === "invited").length;

  // The viewer's own membership decides what the roster offers them.
  const viewerMember = members.find(
    (m) => m.status === "active" && m.userId === session?.user?.id
  );
  const viewerRole: OrganizationRole = viewerMember?.role ?? "member";
  const viewerMemberId = viewerMember?.id ?? null;

  const formatJoinedAt = (value: Date | string | undefined) => {
    const date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Load the active organization's real members and pending invitations.
  const activeOrgId = activeOrg?.id;
  useEffect(() => {
    let isCancelled = false;

    async function loadMembers() {
      if (!activeOrgId) {
        if (!isCancelled) {
          setMembers([]);
          setMembersError(null);
        }
        return;
      }

      setIsMembersLoading(true);
      setMembersError(null);
      try {
        const [membersResult, invitationsResult] = await Promise.all([
          organization.listMembers({ query: { organizationId: activeOrgId } }),
          organization.listInvitations({ query: { organizationId: activeOrgId } }),
        ]);

        if (membersResult.error) {
          throw new Error(membersResult.error.message || "Failed to load members");
        }

        const activeMembers: OrganizationMember[] = (
          (membersResult.data?.members ?? []) as Array<{
            id: string;
            userId?: string | null;
            role: string;
            createdAt?: Date | string;
            user?: { name?: string | null; email?: string | null } | null;
          }>
        ).map((m) => ({
          id: m.id,
          userId: m.userId ?? null,
          name: m.user?.name || m.user?.email || "Unknown member",
          email: m.user?.email || "—",
          role: (["owner", "admin", "member"].includes(m.role) ? m.role : "member") as
            | "owner"
            | "admin"
            | "member",
          status: "active" as const,
          joinedAt: formatJoinedAt(m.createdAt),
        }));

        // Invitations are only surfaced when the caller may read them; a failure here
        // must not hide the member list.
        const pendingInvites: OrganizationMember[] = invitationsResult.error
          ? []
          : (
              (invitationsResult.data ?? []) as Array<{
                id: string;
                email: string;
                role: string;
                status: string;
                createdAt?: Date | string;
              }>
            )
              .filter((inv) => inv.status === "pending")
              .map((inv) => ({
                id: inv.id,
                userId: null,
                name: inv.email.split("@")[0],
                email: inv.email,
                role: (["owner", "admin", "member"].includes(inv.role)
                  ? inv.role
                  : "member") as "owner" | "admin" | "member",
                status: "invited" as const,
                joinedAt: formatJoinedAt(inv.createdAt),
              }));

        if (!isCancelled) {
          setMembers([...activeMembers, ...pendingInvites]);
        }
      } catch (err) {
        if (!isCancelled) {
          setMembersError(
            err instanceof Error ? err.message : "Failed to load organization members"
          );
        }
      } finally {
        if (!isCancelled) {
          setIsMembersLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, reloadKey]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgSlug) {
      toast.error("Please provide both organization name and unique slug.");
      return;
    }

    setIsCreatingOrg(true);
    try {
      const result = await organization.create({
        name: orgName,
        slug: orgSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to create organization.");
      } else {
        toast.success(`Organization "${orgName}" created successfully!`);
        setOrgName("");
        setOrgSlug("");
      }
    } catch {
      toast.error("An unexpected error occurred while creating organization.");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) {
      toast.error("Please select an organization first.");
      return;
    }

    if (!inviteEmail) {
      toast.error("Please enter the email address to invite.");
      return;
    }

    setIsInviting(true);
    try {
      const result = await organization.inviteMember({
        email: inviteEmail,
        role: inviteRole as "member" | "admin" | "owner",
        organizationId: activeOrg.id,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to send invitation.");
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setReloadKey((k) => k + 1);
      }
    } catch {
      toast.error("Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (member: OrganizationMember, role: OrganizationRole) => {
    if (!activeOrg) return;

    setPendingMemberId(member.id);
    try {
      const result = await organization.updateMemberRole({
        memberId: member.id,
        role,
        organizationId: activeOrg.id,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to change role.");
      } else {
        toast.success(`${member.name} is now ${describeRole(role).toLowerCase()}.`);
        setReloadKey((k) => k + 1);
      }
    } catch {
      toast.error("Failed to change role.");
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!activeOrg) return;

    setMemberToRemove(null);
    setPendingMemberId(member.id);
    try {
      const result = await organization.removeMember({
        memberIdOrEmail: member.id,
        organizationId: activeOrg.id,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to remove member.");
      } else {
        toast.success(`${member.name} was removed from ${activeOrg.name}.`);
        setReloadKey((k) => k + 1);
      }
    } catch {
      toast.error("Failed to remove member.");
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleCancelInvitation = async (member: OrganizationMember) => {
    setPendingMemberId(member.id);
    try {
      const result = await organization.cancelInvitation({ invitationId: member.id });

      if (result.error) {
        toast.error(result.error.message || "Failed to cancel invitation.");
      } else {
        toast.success(`Invitation for ${member.email} was cancelled.`);
        setReloadKey((k) => k + 1);
      }
    } catch {
      toast.error("Failed to cancel invitation.");
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleSwitchOrg = async (orgId: string | null) => {
    try {
      await organization.setActive({
        organizationId: orgId,
      });
      toast.success(orgId ? "Switched organization" : "Switched to personal account");
    } catch {
      toast.error("Failed to switch workspace context.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Reusable PageHeader */}
      <PageHeader
        title="Organizations & Multi-Tenancy"
        description="Manage your teams, invite members, or switch between personal and organization accounts."
        tag="Multi-Tenant"
        category="Better Auth Plugin"
      >
        <Badge
          variant="outline"
          className="border-border/80 font-mono text-[11px] py-1 px-2.5 bg-background/50"
        >
          Active: {activeOrg ? activeOrg.name : "Personal Account"}
        </Badge>
      </PageHeader>

      {/* Active Workspace Banner */}
      <Card className="card-vercel rounded-xl border border-border/80 shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="size-4 text-foreground" />
                Current Workspace:{" "}
                <span className="font-semibold text-foreground">
                  {activeOrg ? activeOrg.name : "Personal Account"}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {activeOrg
                  ? `Slug: ${activeOrg.slug} • Multi-tenant workspace`
                  : "You are currently working in your personal user workspace."}
              </CardDescription>
            </div>
            {activeOrg && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-border/80"
                onClick={() => handleSwitchOrg(null)}
              >
                Switch to Personal Account
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Organization */}
        <Card className="card-vercel rounded-xl border border-border/80 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-foreground" />
              Create New Organization
            </CardTitle>
            <CardDescription className="text-xs">
              Organizations allow multiple team members to share resources and billing.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateOrg}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Corporation"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    if (!orgSlug) {
                      setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    }
                  }}
                  disabled={isCreatingOrg}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgSlug">URL Slug</Label>
                <Input
                  id="orgSlug"
                  placeholder="acme-corp"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  disabled={isCreatingOrg}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier used for workspace scoping and subdomains.
                </p>
              </div>

              <Button type="submit" disabled={isCreatingOrg} className="w-full btn-studio-glow text-xs font-semibold">
                {isCreatingOrg ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Creating Organization...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 size-3.5" />
                    Create Organization
                  </>
                )}
              </Button>
            </CardContent>
          </form>
        </Card>

        {/* Existing Organizations Switcher */}
        <Card className="card-vercel rounded-xl border border-border/80 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="size-4 text-foreground" />
              Your Workspaces
            </CardTitle>
            <CardDescription className="text-xs">
              Select a workspace to switch your active working context.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleSwitchOrg(null)}
              aria-current={!activeOrg ? "true" : undefined}
              className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between text-xs ${
                !activeOrg
                  ? "border-foreground/50 bg-foreground/5 font-semibold shadow-xs"
                  : "border-border/60 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="size-3.5 text-muted-foreground" />
                <span>Personal Account</span>
              </div>
              {!activeOrg && (
                <Badge variant="primary-light">
                  Active
                </Badge>
              )}
            </button>

            {isListLoading ? (
              <div className="flex flex-col gap-3" aria-busy="true" role="status" aria-live="polite">
                <span className="sr-only">Loading your workspaces…</span>
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : listError ? (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertTitle>Could not load your workspaces</AlertTitle>
                <AlertDescription>
                  {listError.message || "The workspace request failed."}
                </AlertDescription>
                <AlertAction>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchList()}>
                    <RefreshCw aria-hidden />
                    Retry
                  </Button>
                </AlertAction>
              </Alert>
            ) : orgList && orgList.length > 0 ? (
              orgList.map((org: { id: string; name: string; slug: string }) => {
                const isSelected = activeOrg?.id === org.id;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSwitchOrg(org.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between text-xs ${
                      isSelected
                        ? "border-foreground/50 bg-foreground/5 font-semibold shadow-xs"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-foreground" />
                      <span>{org.name}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">({org.slug})</span>
                    </div>
                    {isSelected && (
                      <Badge variant="primary-light">
                        Active
                      </Badge>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">No workspaces yet</span>
                  <span className="text-xs text-muted-foreground">
                    Create an organization to collaborate with your team.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("orgName")?.focus()}
                >
                  <Plus aria-hidden />
                  Create organization
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Member Management (ReUI DataGrid) */}
      {activeOrg && (
        <Card className="card-vercel rounded-xl border border-border/80 shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Team Members in {activeOrg.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage members, roles, and pending invitations with ReUI DataGrid.
                </CardDescription>
              </div>
              <Badge variant="info-light" className="font-mono">
                {activeMemberCount} {activeMemberCount === 1 ? "Member" : "Members"}
                {invitedMemberCount > 0 ? ` · ${invitedMemberCount} Invited` : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isMembersLoading ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : membersError ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Could not load members</AlertTitle>
                <AlertDescription>{membersError}</AlertDescription>
                <div data-slot="alert-action">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReloadKey((k) => k + 1)}
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Retry
                  </Button>
                </div>
              </Alert>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center text-xs text-muted-foreground">
                <Users className="size-8 text-muted-foreground/50" />
                <div className="flex flex-col gap-0.5">
                  <span>No members yet.</span>
                  <span>Invite a teammate to collaborate in this workspace.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    document
                      .getElementById("invite-member")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <Mail className="mr-1.5 size-3.5" />
                  Invite a teammate
                </Button>
              </div>
            ) : (
              <OrganizationMembersDataGrid
                members={members}
                viewerRole={viewerRole}
                viewerMemberId={viewerMemberId}
                pendingMemberId={pendingMemberId}
                onChangeRole={handleChangeRole}
                onRemoveMember={setMemberToRemove}
                onCancelInvitation={handleCancelInvitation}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Member Invitations (if in Org mode) */}
      {activeOrg && (
        <Card id="invite-member" className="card-vercel rounded-xl border border-border/80 shadow-xs scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              Invite Team Member to {activeOrg.name}
            </CardTitle>
            <CardDescription className="text-xs">
              Collaborate by sending email invitations to join this organization.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleInviteMember}>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="inviteEmail">Member Email</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isInviting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteRole">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value ?? "member")}
                    disabled={isInviting}
                  >
                    <SelectTrigger id="inviteRole" className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={isInviting} className="btn-studio-glow text-xs font-semibold">
                {isInviting ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Sending Invite...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 size-3.5" />
                    Send Invitation
                  </>
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Removing a member is destructive and cannot be undone from this screen. */}
      <AlertDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          // A destructive confirm stays put while the request is in flight.
          if (pendingMemberId) return;
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Remove {memberToRemove?.name} from this workspace?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to {activeOrg?.name ?? "this workspace"} immediately. Their
              account stays intact, and you can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingMemberId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pendingMemberId !== null}
              onClick={() => {
                if (memberToRemove) void handleRemoveMember(memberToRemove);
              }}
            >
              {pendingMemberId ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
