import { cookies } from "next/headers";

import { verifyPanelCookie } from "@/lib/panel-turnos-auth";

import { PanelLogin } from "../panel-login";
import { PanelRecompensasClient } from "./panel-recompensas-client";

export default async function PanelRecompensasPage() {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return <PanelLogin />;
  }

  return <PanelRecompensasClient />;
}
