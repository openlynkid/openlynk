import type { Metadata } from "next";
import { AppearanceClient } from "./appearance-client";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Choose a theme, set an accent colour, and connect a custom domain.",
};

export default function AppearancePage() {
  return <AppearanceClient />;
}
