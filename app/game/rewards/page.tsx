import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGameHref } from "@/lib/game/paths";

/** Legacy /rewards → dedicated Claim page. */
export default async function RewardsAliasPage() {
  const h = await headers();
  const host = h.get("host");
  redirect(getGameHref(host).claim);
}
