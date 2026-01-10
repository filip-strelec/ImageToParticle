"use server";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authPassword = process.env.AUTH_PASSWORD;

  // If no password is set, skip auth
  if (!authPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [type, credentials] = authHeader.split(" ");

    if (type === "Basic" && credentials) {
      try {
        const decoded = atob(credentials);
        const [username, password] = decoded.split(":");

        // Accept any username, just check password
        if (password === authPassword) {
          return NextResponse.next();
        }
      } catch {
        // Invalid base64, fall through to auth prompt
      }
    }
  }

  // Return 401 with WWW-Authenticate header to prompt for credentials
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Particle Generator"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes that might need to be public
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

