import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next's default Server Action body limit is 1MB. Attachment uploads
      // (src/app/actions/attachments.ts) validate against a 25MB ceiling
      // (ATTACHMENT_MAX_SIZE_BYTES in src/lib/constants.ts) — without raising
      // this, any file over ~1MB 500s before that validation ever runs.
      bodySizeLimit: "30mb",
    },
    // The auth middleware (src/middleware.ts) runs in front of every request,
    // including attachment uploads, and defaults to a separate 10MB body cap
    // of its own — truncating anything larger mid-multipart-form and crashing
    // the parser with "Unexpected end of form" before the action's own 25MB
    // check runs. Raise it to match. (middlewareClientMaxBodySize is the
    // deprecated alias for this same option — Next.js 16.3 rejects setting both.)
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
