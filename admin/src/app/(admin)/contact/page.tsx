"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";

export default function ContactPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [contactAs, setContactAs] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = new URLSearchParams({
        limit: "30",
        ...(status ? { status } : {}),
        ...(contactAs ? { contactAs } : {}),
      });
      const json = await adminFetch<any>(`/admin/contacts?${params}`, token);
      setItems(json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, contactAs]);

  const openDetail = async (id: string) => {
    const token = await getToken();
    const json = await adminFetch<any>(`/admin/contacts/${id}`, token);
    setSelected(json.data);
    setReply("");
  };

  const update = async (body: any) => {
    if (!selected) return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(`/admin/contacts/${selected._id}`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await openDetail(selected._id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Contact Inbox"
        description="Messages from Contact Plazore — separate from Reports. Buyer vs Seller context is stored on each message."
      />

      <Panel className="mb-4 flex flex-wrap gap-3 p-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
        <Select value={contactAs} onChange={(e) => setContactAs(e.target.value)} className="w-40">
          <option value="">All contexts</option>
          <option value="buyer">As Buyer</option>
          <option value="seller">As Seller</option>
        </Select>
      </Panel>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && items.length === 0 && (
        <EmptyState
          title="No contact messages yet"
          body="Inbox is empty until users submit Contact Plazore messages."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2">
          {items.map((m) => (
            <button
              key={m._id}
              type="button"
              onClick={() => openDetail(m._id)}
              className={`w-full border p-3 text-left transition ${
                selected?._id === m._id
                  ? "border-green/30 bg-green/5"
                  : "border-line bg-surface hover:border-white/15"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{m.subject}</p>
                  <p className="text-xs text-muted">
                    {m.user?.name || "User"} · {m.user?.email}
                  </p>
                </div>
                <Badge tone={m.status === "new" ? "green" : "neutral"}>{m.status}</Badge>
              </div>
              <div className="mt-2 flex gap-2">
                <Badge tone="blue">As {m.contactAs}</Badge>
                <Badge>{m.category}</Badge>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <Panel className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <p className="text-sm text-secondary">
                  {selected.user?.name} · contacting as{" "}
                  <span className="text-green">{selected.contactAs}</span>
                </p>
              </div>
              <Badge>{selected.status}</Badge>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm text-text/90">{selected.message}</p>

            {selected.responses?.length > 0 && (
              <div className="mt-6 space-y-3 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Responses
                </p>
                {selected.responses.map((r: any, i: number) => (
                  <div key={i} className="border border-line bg-surface-2 p-3 text-sm">
                    <p className="text-xs text-muted">
                      {r.admin?.name || "Admin"} ·{" "}
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                    </p>
                    <p className="mt-1">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                placeholder="Write a response…"
                className="w-full border border-line bg-surface-2 p-3 text-sm outline-none focus:border-green/40"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !reply.trim()}
                  onClick={() => update({ response: reply })}
                >
                  Send response
                </Button>
                <Button tone="ghost" disabled={busy} onClick={() => update({ status: "in_progress" })}>
                  In progress
                </Button>
                <Button tone="ghost" disabled={busy} onClick={() => update({ status: "resolved" })}>
                  Resolve
                </Button>
                <Button tone="ghost" disabled={busy} onClick={() => update({ status: "closed" })}>
                  Close
                </Button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}