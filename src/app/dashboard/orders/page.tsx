import type { Metadata } from "next";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = {
  title: "Orders",
  description: "Completed sales, payouts, and buyer details for your storefront.",
};

export default function OrdersPage() {
  return <OrdersClient />;
}
