import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/csp";
import { getBlobPublicHost } from "@/lib/storage/blob-host";

// Optimistic gate only: it checks that a session cookie exists, not that it is valid.
// Real authorization happens server-side in requireAdmin() (src/lib/session.ts).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession) return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // A new nonce per request. Next.js reads it from the request's CSP header and puts it on every script and style
  // it renders, which is why pages must be rendered per request (they are: content comes from the database).
  const development = process.env.NODE_ENV === "development";
  const blobHost = getBlobPublicHost();
  const policy = buildCsp({
    nonce: createNonce(),
    development,
    https: request.nextUrl.protocol === "https:",
    imageHosts: blobHost ? [`https://${blobHost}`] : [],
  });
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // In development the policy only reports, so a missed directive can never break the page while building features.
  response.headers.set(development ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", policy);
  return response;
}

// The cookie check above is only an optimistic redirect. Prefetch requests skip this function (see `missing` below),
// so the real protection of every admin page, action and route is requireAdmin()/getAdmin() inside it. Keep calling
// one of them first in anything new under /admin or /api/admin.
export const config = {
  matcher: [
    {
      // Pages only: not API routes, build assets, optimized images, uploaded files or the favicon. The trailing slashes
      // matter: without them a future page such as /api-docs or /uploads-guide would silently get no CSP.
      source: "/((?!api/|_next/static/|_next/image|uploads/|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
