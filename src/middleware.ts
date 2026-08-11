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
  "/downloads",
];
const authRoutes = ["/login", "/cadastro", "/esqueci-senha"];

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
  isApiRoute: boolean,
  isAuthRoute: boolean
): boolean {
  if (isApiRoute) return false;
  if (isAuthRoute) return true;
  if (pathname === "/" || pathname === "/configuracao" || pathname === "/pesquisa") return true;
  return !isPublic;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const { pathname } = request.nextUrl;
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname === r);
  const isApiRoute = pathname.startsWith("/api/");
  // Painel do dono: login/cookie próprios — não exige sessão Supabase do SaaS
  const isDonoArea =
    pathname.startsWith("/dono") || pathname.startsWith("/api/dono");

  if (isDonoArea) {
    return supabaseResponse;
  }

  if (!user && !isPublic && pathname !== "/" && !isApiRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/" && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && routeNeedsProfileCheck(pathname, isPublic, isApiRoute, isAuthRoute)) {
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
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|downloads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
