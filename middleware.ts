import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect the Time Kiosk route at the edge based on a cookie value
  if (pathname.startsWith("/kiosk")) {
    const enabled = req.cookies.get("kioskEnabled")?.value;
    if (enabled === "0") {
      const url = req.nextUrl.clone();
      url.pathname = "/kiosk-disabled";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Only run middleware for /kiosk routes (not for /kiosk-disabled)
export const config = {
  matcher: ["/kiosk/:path*"],
};
