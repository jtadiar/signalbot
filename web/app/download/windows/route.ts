import { redirect } from "next/navigation";

const CURRENT_VERSION = "1.0.7";

export function GET() {
  redirect(`/downloads/HL.Signalbot_${CURRENT_VERSION}_x64-setup.exe`);
}
