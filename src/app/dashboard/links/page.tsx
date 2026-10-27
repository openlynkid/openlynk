import type { Metadata } from "next";
import { LinksClient } from "./links-client";

export const metadata: Metadata = {
  title: "Links & Blocks",
  description: "Arrange the links, headers and dividers on your OpenLynk page.",
};

export default function LinksPage() {
  return <LinksClient />;
}
