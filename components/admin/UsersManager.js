"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Eye, KeyRound, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useListQuery } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from "@/components/ui/DataTable";
import { Avatar, Badge, StatusBadge } from "@/components/ui/Primitives";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { formatDate, timeAgo, titleCase } from "@/lib/utils";

export function StatusChangeDialog({ target, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const status = target?.status;
  const verb = status === "ACTIVE" ? "Reactivate" : status === "SUSPENDED" ? "Suspend" : "Ban";

  async function submit() {
    setLoading(true);
    try {
      await apiFetch(`/api/admin/users/${target.user.id}`, { method: "PATCH", body: { status, statusReason: reason } });
      toast.success(`${target.user.name} ${status === "ACTIVE" ? "reactivated" : status.toLowerCase()}`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onClose={onClose}
      onConfirm={submit}
      loading={loading}
      tone={status === "ACTIVE" ? "primary" : "danger"}
      title={target ? `${verb} ${target.user.name}?` : ""}
      confirmLabel={verb}
      description={
        status === "ACTIVE"
          ? "The user will be able to sign in again."
          : "The user will be signed out immediately and won't be able to sign in until reactivated."
      }
    >
      {status !== "ACTIVE" && (
        <div className="mt-4">
          <Field label="Reason (optional, internal)" htmlFor="reason">
            <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}
    </ConfirmDialog>
  );
}

export function ResetLinkDialog({ user, onClose }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  async function generate() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/users/${user.id}/reset-link`, { method: "POST" });
      setLink(data.url);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open={Boolean(user)}
      onClose={() => {
        setLink(null);
        onClose();
      }}
      title="Password reset link"
      description={user ? `Generate a one-time link for ${user.email}. It expires in 30 minutes.` : ""}
      size="sm"
      footer={
        !link && (
          <Button onClick={generate} loading={loading}>
            Generate link
          </Button>
        )
      }
    >
      {link ? (
        <div className="space-y-3">
          <Input readOnly value={link} onFocus={(e) => e.target.select()} />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast.success("Link copied");
            }}
          >
            Copy link
          </Button>
          <p className="text-xs text-slate-500">Share it only with the account owner through a trusted channel.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Use this when the client can&apos;t receive WhatsApp messages.</p>
      )}
    </Modal>
  );
}

export function UsersManager({ isSuper, canManage }) {
  const router = useRouter();
  const list = useListQuery("/api/admin/users", { sort: "createdAt" });
  const { data, loading, error, reload, params } = list;
  const [statusTarget, setStatusTarget] = useState(null);
  const [resetUser, setResetUser] = useState(null);

  const columns = [
    {
      key: "name",
      label: "User",
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} className="size-8" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{u.name}</p>
            <p className="truncate text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: "phone", label: "Phone", render: (u) => <span className="text-slate-600">{u.phone || "—"}</span> },
    ...(isSuper ? [{ key: "role", label: "Role", render: (u) => <Badge tone={u.role === "USER" ? "gray" : "violet"}>{titleCase(u.role)}</Badge> }] : []),
    { key: "status", label: "Status", sortable: true, render: (u) => <StatusBadge status={u.status} /> },
    {
      key: "subscription",
      label: "Subscription",
      render: (u) =>
        u.subscription ? (
          <div>
            <p className="font-medium text-slate-900">{u.subscription.planName}</p>
            <p className="text-xs text-slate-500">until {formatDate(u.subscription.endDate)}</p>
          </div>
        ) : (
          <span className="text-slate-400">None</span>
        ),
    },
    { key: "createdAt", label: "Joined", sortable: true, render: (u) => <span className="text-slate-600">{formatDate(u.createdAt)}</span> },
    { key: "lastLoginAt", label: "Last login", sortable: true, render: (u) => <span className="text-slate-600">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</span> },
    {
      key: "actions",
      label: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      render: (u) => {
        const manageable = canManage && (isSuper || u.role === "USER");
        return (
          <Menu>
            <MenuItem icon={Eye} onClick={() => router.push(`/admin/users/${u.id}`)}>
              View details
            </MenuItem>
            {manageable && (
              <>
                <MenuDivider />
                {u.status !== "ACTIVE" && (
                  <MenuItem icon={UserCheck} onClick={() => setStatusTarget({ user: u, status: "ACTIVE" })}>
                    Reactivate
                  </MenuItem>
                )}
                {u.status !== "SUSPENDED" && (
                  <MenuItem icon={UserX} onClick={() => setStatusTarget({ user: u, status: "SUSPENDED" })}>
                    Suspend
                  </MenuItem>
                )}
                {u.status !== "BANNED" && (
                  <MenuItem icon={Ban} tone="danger" onClick={() => setStatusTarget({ user: u, status: "BANNED" })}>
                    Ban
                  </MenuItem>
                )}
                <MenuDivider />
                <MenuItem icon={KeyRound} onClick={() => setResetUser(u)}>
                  Password reset link
                </MenuItem>
                {isSuper && u.role === "USER" && (
                  <MenuItem icon={ShieldCheck} onClick={() => router.push(`/admin/users/${u.id}#role`)}>
                    Change role
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        );
      },
    },
  ];

  return (
    <div className="card overflow-hidden">
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, email, phone…" />
        <FilterSelect
          label="All statuses"
          value={params.status}
          onChange={(v) => list.setFilter("status", v)}
          options={["ACTIVE", "SUSPENDED", "BANNED"].map((s) => ({ value: s, label: titleCase(s) }))}
        />
        <FilterSelect
          label="Any subscription"
          value={params.subscription}
          onChange={(v) => list.setFilter("subscription", v)}
          options={[
            { value: "active", label: "Active subscribers" },
            { value: "none", label: "No active plan" },
          ]}
        />
        {isSuper && (
          <FilterSelect
            label="All roles"
            value={params.role}
            onChange={(v) => list.setFilter("role", v)}
            options={["USER", "ADMIN", "SUPER_ADMIN"].map((s) => ({ value: s, label: titleCase(s) }))}
          />
        )}
      </Toolbar>
      <DataTable
        columns={columns}
        rows={data?.users}
        loading={loading}
        error={error}
        onRetry={reload}
        sort={params.sort}
        order={params.order}
        onSort={list.toggleSort}
      />
      <Pagination meta={data?.meta} onPage={list.setPage} />
      <StatusChangeDialog target={statusTarget} onClose={() => setStatusTarget(null)} onDone={reload} />
      <ResetLinkDialog user={resetUser} onClose={() => setResetUser(null)} />
    </div>
  );
}
