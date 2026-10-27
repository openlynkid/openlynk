import type { Metadata } from "next";
import { OrganizationsClient } from "./organizations-client";

export const metadata: Metadata = {
  title: "Organizations & Multi-Tenancy",
  description: "Manage teams, invite members, and configure organization workspaces.",
};

export default function OrganizationsPage() {
  return <OrganizationsClient />;
}
