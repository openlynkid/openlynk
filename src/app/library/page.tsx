import type { Metadata } from "next";
import { LibraryClient } from "./library-client";

export const metadata: Metadata = {
  title: "My Library",
  description: "Your purchased digital products, files, and licence keys.",
};

export default function LibraryPage() {
  return <LibraryClient />;
}
