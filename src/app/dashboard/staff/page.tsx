import { Users, Trash2, ShieldCheck, Eye } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle } from "@/components/ui";
import { OWNER_ONLY } from "@/lib/permissions";
import { StaffForm } from "./staff-form";
import { updateStaffRole, removeStaff, previewAsStaff } from "./actions";

export default async function StaffPage() {
  const { business } = await requireOwner();
  const team = await db.user.findMany({
    where: { businessId: business.id },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  return (
    <Page>
      <Head
        kicker="Team"
        title="Staff & permissions"
        sub="Invite your team and control who can see money, customers, and settings."
        right={
          // Cookie-based preview only works under the dev stub; with real auth,
          // test the staff view by signing in as a staff member.
          !process.env.CLERK_SECRET_KEY ? (
            <form action={previewAsStaff}>
              <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                <Eye size={15} /> Preview staff view
              </button>
            </form>
          ) : null
        }
      />

      <Card className="mb-4">
        <CardTitle icon={<Users size={15} />} title="Add a team member" />
        <StaffForm />
      </Card>

      <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="hidden sm:grid grid-cols-[1fr_110px_180px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          <div>Email</div>
          <div>Role</div>
          <div className="text-right">Manage</div>
        </div>
        {team.length === 0 ? (
          <p className="text-[13px] px-4 py-6" style={{ color: "var(--muted)" }}>No team members yet — add one above.</p>
        ) : (
          team.map((u) => {
            const isOwner = u.role === "owner";
            return (
              <div key={u.id} className="grid sm:grid-cols-[1fr_110px_180px] grid-cols-2 gap-3 px-4 py-3 items-center" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{u.email}</div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-md font-medium" style={{ background: isOwner ? "color-mix(in srgb, var(--pine) 12%, transparent)" : "var(--sand)", color: isOwner ? "var(--pine)" : "var(--muted)" }}>
                    {isOwner && <ShieldCheck size={11} />} {isOwner ? "Owner" : "Staff"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <form action={updateStaffRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="role" value={isOwner ? "staff" : "owner"} />
                    <button type="submit" className="text-[12px] px-2 py-1 rounded-md" style={{ background: "var(--paper)", color: "var(--ink)" }}>
                      Make {isOwner ? "staff" : "owner"}
                    </button>
                  </form>
                  <form action={removeStaff}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }} aria-label="Remove">
                      <Trash2 size={12} style={{ color: "var(--clay)" }} />
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Card>
        <CardTitle title="What staff can and can't see" />
        <p className="text-[13px] mb-3" style={{ color: "var(--ink-soft)" }}>
          Staff members get the kitchen and selling tools — Menu, Orders, Kitchen OS, Kitchen Display, Purchasing, Inventory, Labels &amp; packing, Delivery Routes, and POS. These owner-only areas are hidden from them:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {OWNER_ONLY.map((p) => (
            <span key={p} className="text-[11.5px] px-2 py-1 rounded-md font-mono" style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--muted)" }}>
              {p.replace("/dashboard/", "")}
            </span>
          ))}
        </div>
      </Card>
    </Page>
  );
}
