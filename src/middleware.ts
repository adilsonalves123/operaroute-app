import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/cadastro", "/auth/callback"];
const authRoutes = ["/login", "/cadastro"];

function needsOnboarding(profile: {
  onboarding_completo?: boolean | null;
  empresa_id?: string | null;
} | null) {
  if (!profile) return true;
  return !profile.empresa_id;
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

  if (!user && !isPublic && pathname !== "/" && !isApiRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const getProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completo, empresa_id")
      .eq("user_id", user!.id)
      .maybeSingle();
    return data;
  };

  if (user && isAuthRoute) {
    const profile = await getProfile();
    if (needsOnboarding(profile)) {
      return NextResponse.redirect(new URL("/configuracao", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && pathname === "/configuracao") {
    const profile = await getProfile();
    if (profile && !needsOnboarding(profile)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (user && !isPublic && !isApiRoute && pathname !== "/configuracao" && pathname !== "/") {
    const profile = await getProfile();
    if (needsOnboarding(profile)) {
      return NextResponse.redirect(new URL("/configuracao", request.url));
    }
  }

  if (pathname === "/") {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const profile = await getProfile();
    if (needsOnboarding(profile)) {
      return NextResponse.redirect(new URL("/configuracao", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
