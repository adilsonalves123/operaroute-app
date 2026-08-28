import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = [
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/auth/callback",
  "/termos",
  "/privacidade",
  "/suporte-contato",
  "/parceiro",
  "/c",
  "/r",
  "/downloads",
];
const authRoutes = ["/login", "/cadastro", "/esqueci-senha"];

/** Evita 504 MIDDLEWARE_INVOCATION_TIMEOUT quando o Auth do Supabase trava. */
const SUPABASE_FETCH_TIMEOUT_MS = 4_000;

type MiddlewareProfile = {
  onboarding_completo?: boolean | null;
  empresa_id?: string | null;
} | null;

function needsOnboarding(profile: MiddlewareProfile) {
  if (!profile) return true;
  return !profile.empresa_id;
}

function routeNeedsProfileCheck(
  pathname: string,
  isPublic: boolean,
  isAuthRoute: boolean
): boolean {
  if (isAuthRoute) return true;
  if (pathname === "/" || pathname === "/configuracao" || pathname === "/pesquisa") return true;
  return !isPublic;
}

function fetchComTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS);
  const callerSignal = init?.signal;
  const signal =
    callerSignal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;
  return fetch(input, { ...init, signal });
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Painel do dono: login próprio — não exige sessão Supabase do SaaS
  if (pathname.startsWith("/dono")) {
    return supabaseResponse;
  }

  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname === r);

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { fetch: fetchComTimeout },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublic && pathname !== "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname === "/" && !user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (user && routeNeedsProfileCheck(pathname, isPublic, isAuthRoute)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completo, empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const onboarding = needsOnboarding(profile);

      if (isAuthRoute) {
        return NextResponse.redirect(
          new URL(onboarding ? "/pesquisa" : "/dashboard", request.url)
        );
      }

      if (
        (pathname === "/configuracao" || pathname === "/pesquisa") &&
        !onboarding
      ) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      if (pathname === "/") {
        return NextResponse.redirect(
          new URL(onboarding ? "/pesquisa" : "/dashboard", request.url)
        );
      }

      if (
        !isPublic &&
        pathname !== "/configuracao" &&
        pathname !== "/pesquisa" &&
        onboarding
      ) {
        return NextResponse.redirect(new URL("/pesquisa", request.url));
      }
    }

    return supabaseResponse;
  } catch {
    // Timeout/rede: não segura a página no 504. Rotas privadas vão para login.
    if (!isPublic && pathname !== "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }
}

export const config = {
  matcher: [
    /*
     * Páginas apenas. /api/* autentica sozinho (requireAcesso/getProfile) —
     * tirar do middleware evita 504 em leituras IA / uploads longos.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|downloads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
