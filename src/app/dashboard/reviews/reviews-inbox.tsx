"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, RotateCcw, MessageSquareReply } from "lucide-react";
import { setReviewStatus, replyToReview, type ReviewStatus, type ReviewActionResult } from "./actions";

export type InboxReview = {
  id: string;
  mealName: string;
  customerName: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  status: ReviewStatus;
  createdAt: string;
};

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: "Awaiting approval" },
  { key: "approved", label: "Live" },
  { key: "hidden", label: "Hidden" },
];

export function ReviewsInbox({ reviews }: { reviews: InboxReview[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [msg, setMsg] = useState<ReviewActionResult | null>(null);
  const [replying, setReplying] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ReviewActionResult>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      router.refresh();
    });

  const list = reviews.filter((r) => r.status === tab);
  const count = (k: ReviewStatus) => reviews.filter((r) => r.status === k).length;
  const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

  return (
    <div>
      <div className="inline-flex rounded-lg border p-0.5 mb-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-md text-[12.5px] font-medium"
            style={{ background: tab === t.key ? "var(--pine)" : "transparent", color: tab === t.key ? "#f4f2ec" : "var(--muted)" }}
          >
            {t.label} · {count(t.key)}
          </button>
        ))}
      </div>

      {msg && (
        <p className="text-[12.5px] mb-3" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>{msg.message}</p>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            {tab === "pending" ? "Nothing waiting — you're all caught up." : tab === "approved" ? "No live reviews yet." : "Nothing hidden."}
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>Customers can review any meal they've ordered from their account page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const draft = replying[r.id];
            return (
              <div key={r.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{r.mealName}</span>
                      <span style={{ color: "#c98a2b", letterSpacing: 1, fontSize: 13 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                      {r.customerName} · verified order · {fmt.format(new Date(r.createdAt))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status !== "approved" && (
                      <Btn onClick={() => run(() => setReviewStatus(r.id, "approved"))} disabled={pending} primary>
                        <Check size={13} /> Approve
                      </Btn>
                    )}
                    {r.status !== "hidden" && (
                      <Btn onClick={() => run(() => setReviewStatus(r.id, "hidden"))} disabled={pending}>
                        <EyeOff size={13} /> Hide
                      </Btn>
                    )}
                    {r.status === "hidden" && (
                      <Btn onClick={() => run(() => setReviewStatus(r.id, "pending"))} disabled={pending}>
                        <RotateCcw size={13} /> Re-queue
                      </Btn>
                    )}
                  </div>
                </div>

                {r.comment ? (
                  <p className="text-[13.5px] mt-3 leading-relaxed" style={{ color: "var(--ink-soft)" }}>“{r.comment}”</p>
                ) : (
                  <p className="text-[12.5px] mt-3 italic" style={{ color: "var(--muted)" }}>Rating only — no written comment.</p>
                )}

                {/* Public reply */}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                  {draft === undefined ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {r.reply ? (
                        <p className="text-[12.5px] pl-2" style={{ color: "var(--muted)", borderLeft: "2px solid var(--line)" }}>
                          <span className="font-medium" style={{ color: "var(--ink)" }}>Your reply:</span> {r.reply}
                        </p>
                      ) : (
                        <span className="text-[12px]" style={{ color: "var(--muted)" }}>No public reply yet.</span>
                      )}
                      <Btn onClick={() => setReplying((s) => ({ ...s, [r.id]: r.reply ?? "" }))} disabled={pending}>
                        <MessageSquareReply size={13} /> {r.reply ? "Edit reply" : "Reply publicly"}
                      </Btn>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={draft}
                        onChange={(e) => setReplying((s) => ({ ...s, [r.id]: e.target.value }))}
                        maxLength={400}
                        rows={2}
                        placeholder="Thanks so much — glad you loved it!"
                        className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none"
                        style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Btn
                          primary
                          disabled={pending}
                          onClick={() => {
                            run(() => replyToReview(r.id, draft));
                            setReplying((s) => { const n = { ...s }; delete n[r.id]; return n; });
                          }}
                        >
                          <Check size={13} /> Post reply
                        </Btn>
                        <Btn disabled={pending} onClick={() => setReplying((s) => { const n = { ...s }; delete n[r.id]; return n; })}>Cancel</Btn>
                        <span className="text-[11px] ml-auto" style={{ color: "var(--muted)" }}>Shown publicly under the review</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border disabled:opacity-50"
      style={primary
        ? { background: "var(--pine)", color: "#f4f2ec", borderColor: "var(--pine)" }
        : { borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}
    >
      {children}
    </button>
  );
}
