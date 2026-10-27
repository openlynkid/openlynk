import type { Metadata } from "next";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Profile & Settings",
  description: "Manage personal account profile, credentials, and authentication sessions.",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
