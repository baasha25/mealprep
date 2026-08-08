import type { Metadata } from "next";
import { DemoTour } from "./demo-tour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PrepFlow — Guided demo",
  description: "A guided walkthrough of PrepFlow for independent meal-prep kitchens.",
};

// Generic, un-attributed demo link. Reps should use /demo/<their-name> so the
// signup is credited to them; this bare version credits the "demo" channel.
export default function DemoPage() {
  return <DemoTour rep={null} repName={null} />;
}
