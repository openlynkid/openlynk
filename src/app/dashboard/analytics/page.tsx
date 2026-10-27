import type { Metadata } from "next";
import { AnalyticsClient } from "./analytics-client";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Page views, link clicks, and sales for your OpenLynk page.",
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
