import Link from "next/link";
import { Leaf } from "lucide-react";
import { cldLogo } from "@/lib/cloudinary";

/**
 * The storefront's branded header — logo (or leaf + name), the kitchen's one-line
 * tagline, and the account link. Shared by the menu page and each meal page so a
 * customer arriving from Google on a meal lands in the same brand frame.
 */
export function StoreHeader({
  slug,
  name,
  logoUrl,
  tagline,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;
}) {
  return (
    <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href={`/store/${slug}`} className="flex items-center gap-2.5 min-w-0" aria-label={`${name} — menu`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cldLogo(logoUrl, { h: 44 }) ?? logoUrl}
              alt={name}
              className="h-11 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <>
              <div className="grid place-items-center w-8 h-8 rounded-md shrink-0" style={{ background: "var(--pine)" }}>
                <Leaf size={17} color="#f4f2ec" />
              </div>
              <div className="min-w-0">
                <div className="disp text-[18px] font-medium leading-none truncate" style={{ color: "var(--ink)" }}>
                  {name}
                </div>
                <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>
                  {tagline || "Fresh meals, made to order"}
                </div>
              </div>
            </>
          )}
        </Link>
        <Link href={`/store/${slug}/account`} className="text-[13px] font-medium shrink-0" style={{ color: "var(--pine)" }}>
          My account →
        </Link>
      </div>
    </header>
  );
}
