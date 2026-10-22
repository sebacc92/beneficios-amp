import {
  createQwikCity,
  type PlatformCloudflarePages,
} from "@builder.io/qwik-city/middleware/cloudflare-pages";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";
import { serveMedia } from "./server/media";

declare global {
  type QwikCityPlatform = PlatformCloudflarePages & { env?: CloudflareEnv };
}

const qwikFetch = createQwikCity({ render, qwikCityPlan });

export function fetch(
  request: Request,
  env: CloudflareEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  if (new URL(request.url).pathname.startsWith("/media/")) {
    return serveMedia(request, env);
  }
  // Qwik 1.20 types ASSETS.fetch as synchronous; the runtime awaits its result.
  // @ts-expect-error Upstream ASSETS.fetch returns Response instead of Promise<Response>.
  return qwikFetch(request, env, ctx);
}
