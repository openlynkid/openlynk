"use client";

import { useMemo, useState } from "react";
import {
  DataGrid,
  DataGridFeatures,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canManageInvitations,
  describeRole,
  getMemberCapabilities,
  type OrganizationRole,
} from "@/modules/organization/member-management";
import { MoreHorizontal, Search, ShieldCheck, Trash2, UserRoundMinus, Users } from "lucide-react";

export interface OrganizationMember {
  id: string;
  /** Owner's user id, used to find the viewer's own membership row. */
  userId: string | null;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited";
  joinedAt: string;
}

interface OrganizationMembersDataGridProps {
  members: OrganizationMember[];
  viewerRole: OrganizationRole;
  /** The viewer's `member` row id, so their own row offers no removal. */
  viewerMemberId: string | null;
  /** Row currently awaiting a server response; its actions stay disabled. */
  pendingMemberId: string | null;
  onChangeRole: (member: OrganizationMember, role: OrganizationRole) => void;
  onRemoveMember: (member: OrganizationMember) => void;
  onCancelInvitation: (member: OrganizationMember) => void;
}

export function OrganizationMembersDataGrid({
  members,
  viewerRole,
  viewerMemberId,
  pendingMemberId,
  onChangeRole,
  onRemoveMember,
  onCancelInvitation,
}: OrganizationMembersDataGridProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members;
    const term = searchTerm.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.role.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

  const columns = useMemo<ColumnDef<DataGridFeatures, OrganizationMember>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataGridColumnHeader title="Member" column={column} />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5 py-1">
            <div className="flex size-7 items-center justify-center rounded-full bg-muted font-medium text-xs text-foreground uppercase shrink-0 border border-border/50">
              {row.original.name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-xs text-foreground truncate">{row.original.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{row.original.email}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => <DataGridColumnHeader title="Role" column={column} />,
        cell: ({ row }) => {
          const role = row.original.role;
          const variant =
            role === "owner" ? "primary-light" : role === "admin" ? "info-light" : "secondary";
          return (
            <Badge variant={variant} className="capitalize">
              {role}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant={status === "active" ? "success-light" : "warning-light"}
              size="xs"
              className="capitalize"
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "joinedAt",
        header: ({ column }) => <DataGridColumnHeader title="Joined" column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.joinedAt}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { headerClassName: "text-end", cellClassName: "text-end" },
        cell: ({ row }) => {
          const member = row.original;
          const isPending = pendingMemberId === member.id;
          const capabilities =
            member.status === "active"
              ? getMemberCapabilities(
                  { id: member.id, role: member.role },
                  {
                    viewerRole,
                    viewerMemberId: viewerMemberId ?? "",
                    members: activeMembers.map((m) => ({ id: m.id, role: m.role })),
                  }
                )
              : null;

          const canCancelInvitation =
            member.status === "invited" && canManageInvitations(viewerRole);
          const canChangeRole = (capabilities?.assignableRoles.length ?? 0) > 0;

          if (!canChangeRole && !capabilities?.canRemove && !canCancelInvitation) {
            return <span className="sr-only">No actions available</span>;
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    aria-label={`Manage ${member.name}`}
                  />
                }
              >
                <MoreHorizontal aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canChangeRole && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Change role
                    </DropdownMenuLabel>
                    {capabilities?.assignableRoles.map((role) => (
                      <DropdownMenuItem
                        key={role}
                        disabled={isPending}
                        onClick={() => onChangeRole(member, role)}
                        className="text-xs"
                      >
                        <ShieldCheck aria-hidden className="size-3.5 text-muted-foreground" />
                        Make {describeRole(role).toLowerCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}

                {canChangeRole && (capabilities?.canRemove || canCancelInvitation) && (
                  <DropdownMenuSeparator />
                )}

                {capabilities?.canRemove && (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => onRemoveMember(member)}
                    className="text-xs"
                  >
                    <UserRoundMinus aria-hidden className="size-3.5" />
                    Remove from workspace
                  </DropdownMenuItem>
                )}

                {canCancelInvitation && (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => onCancelInvitation(member)}
                    className="text-xs"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                    Cancel invitation
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      activeMembers,
      onCancelInvitation,
      onChangeRole,
      onRemoveMember,
      pendingMemberId,
      viewerMemberId,
      viewerRole,
    ]
  );

  const table = useTable({
    features: dataGridFeatures,
    data: filteredMembers,
    columns,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-card overflow-hidden">
        <DataGrid table={table} recordCount={filteredMembers.length}>
          {filteredMembers.length === 0 ? (
            <div
              className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-3"
              role="status"
            >
              <Users className="size-8 text-muted-foreground/50" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">No members match your search</span>
                <span>Try a different name, email, or role.</span>
              </div>
              {searchTerm.trim() !== "" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
              <div className="p-2 border-t border-border/50 bg-muted/20">
                <DataGridPagination />
              </div>
            </>
          )}
        </DataGrid>
      </div>
    </div>
  );
}
