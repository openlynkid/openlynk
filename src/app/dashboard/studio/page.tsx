import type { Metadata } from "next";
import { StudioClient } from "./studio-client";

export const metadata: Metadata = {
  title: "Bento Studio",
  description: "Arrange your page as a bento grid: resize tiles, reorder them, and add new ones.",
};

export default function StudioPage() {
  return <StudioClient />;
}
