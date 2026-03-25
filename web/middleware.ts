import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CURRENT_VERSION = "1.0.7";

const DOWNLOAD_REWRITES: Record<string, string> = {
  "/downloads/signalbot-mac.dmg": `/downloads/HL.Signalbot_${CURRENT_VERSION}_universal.dmg`,
  "/downloads/signalbot-windows.exe": `/downloads/HL.Signalbot_${CURRENT_VERSION}_x64-setup.exe`,
};

const OLD_VERSION_PATTERN = /^\/downloads\/HL\.Signalbot_\d+\.\d+\.\d+_(universal\.dmg|x64-setup\.exe)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rewriteTo = DOWNLOAD_REWRITES[pathname];
  if (rewriteTo) {
    return NextResponse.rewrite(new URL(rewriteTo, request.url));
  }

  if (OLD_VERSION_PATTERN.test(pathname)) {
    const stable = pathname.includes("universal.dmg")
      ? "/downloads/signalbot-mac.dmg"
      : "/downloads/signalbot-windows.exe";
    return NextResponse.redirect(new URL(stable, request.url), 302);
  }
}

export const config = {
  matcher: "/downloads/:path*",
};
