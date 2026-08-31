import type { NextConfig } from "next";

const supabaseHostname = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https" as const,
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    imageSizes: [64, 96, 112, 128, 224, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
};

export default nextConfig;
