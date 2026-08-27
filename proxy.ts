import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* ── Rate limiter (in-memory, per-instance) ── */
interface RateRecord {
  count: number;
  resetTime: number;
}
const rateMap = new Map<string, RateRecord>();
const MAX_RATE_RECORDS = 10_000;
const RATE_SWEEP_INTERVAL_MS = 1_000;
let nextRateSweepAt = 0;

function makeRoomForRateRecord(now: number): boolean {
  if (now < nextRateSweepAt) return false;
  nextRateSweepAt = now + RATE_SWEEP_INTERVAL_MS;

  for (const [key, record] of rateMap) {
    if (now >= record.resetTime) rateMap.delete(key);
  }
  return rateMap.size < MAX_RATE_RECORDS;
}

function isRateLimited(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = rateMap.get(key);
  if (!record || now >= record.resetTime) {
    if (
      !record &&
      rateMap.size >= MAX_RATE_RECORDS &&
      !makeRoomForRateRecord(now)
    ) {
      return true;
    }
    rateMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  if (record.count >= max) return true;
  record.count++;
  return false;
}

function getClientIP(req: NextRequest): string {
  // Caddy and Vercel sanitize X-Forwarded-For. X-Real-IP is intentionally
  // ignored because Caddy otherwise forwards an attacker-supplied value.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/* ── Security headers ── */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  /* ── Global rate limit: 100 req/min per IP ── */
  if (isRateLimited(`global:${ip}`, 100, 60_000)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  /* ── API route rate limit: 30 req/min per IP ── */
  if (pathname.startsWith("/api/")) {
    if (isRateLimited(`api:${ip}`, 30, 60_000)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  /* ── Login brute-force protection: 10 req/min per IP ── */
  if (pathname === "/login") {
    if (isRateLimited(`login:${ip}`, 10, 60_000)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  /* ── Auth check for protected routes ── */
  /* 游客可访问 /（dashboard 预览），但 /settings /budget /admin 需要登录 */
  const protectedPrefixes = ["/settings", "/budget", "/admin"];
  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  let response = NextResponse.next({ request });

  /* ── Always refresh the Supabase session (required for SSR cookie sync) ── */
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (isProtected && (error || !user)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  /* ── Guest visiting / → redirect to /guest ── */
  const { data: { session } } = await supabase.auth.getSession();
  if (pathname === "/" && !session) {
    return NextResponse.redirect(new URL("/guest", request.url));
  }

  /* ── Inject security headers ── */
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.svg (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)",
  ],
};
