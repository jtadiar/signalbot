import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const OLD_VERSION_PATTERN = /^\/downloads\/HL\.Signalbot_\d+\.\d+\.\d+_(universal\.dmg|x64-setup\.exe)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (OLD_VERSION_PATTERN.test(pathname)) {
    const dest = pathname.includes("universal.dmg")
      ? "/download/mac"
      : "/download/windows";
    return NextResponse.redirect(new URL(dest, request.url), 302);
  }
}

export const config = {
  matcher: "/downloads/:path*",
};
