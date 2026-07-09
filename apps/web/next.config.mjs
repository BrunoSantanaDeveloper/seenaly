import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@mui/material-nextjs",
    "@flyee/content",
    "@flyee/design-tokens",
    "@flyee/auth",
    "@flyee/db",
    "@flyee/email",
    "@flyee/billing",
    "@flyee/ai",
    "@flyee/jobs",
    "@flyee/knowledge",
    "@flyee/connectors",
    "@flyee/audit",
    "@flyee/documents",
    "@flyee/transcribe",
    "@flyee/whatsapp",
    "@flyee/onboarding",
  ],
  images: {
    formats: ["image/webp", "image/avif"],
    qualities: [90],
  },
};

export default withNextIntl(nextConfig);
