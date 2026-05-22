import { redirect } from "next/navigation";

export default function SalesIndexPage(): never {
  redirect("/sales/by-managers");
}
