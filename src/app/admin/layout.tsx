import { Leaf } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin(); // 404s for anyone not on the admin allowlist

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <header className="border-b" style={{ borderColor: "#ffffff14", background: "var(--sidebar)" }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-2.5">
          <div className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={15} color="#f4f2ec" />
          </div>
          <span className="disp text-[16px] font-medium" style={{ color: "#f4f2ec" }}>PrepFlow</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wide ml-1"
            style={{ background: "#ffffff1f", color: "#f4f2ec" }}
          >
            Admin
          </span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
