import type { Metadata } from "next";
import { ProductsClient } from "./products-client";

export const metadata: Metadata = {
  title: "Digital Products",
  description: "Publish and manage the digital products you sell on OpenLynk.",
};

export default function ProductsPage() {
  return <ProductsClient />;
}
