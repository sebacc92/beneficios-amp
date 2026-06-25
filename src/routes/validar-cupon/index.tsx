import type { RequestHandler } from "@builder.io/qwik-city";

// El validador ahora vive dentro del portal de comercios con login.
export const onRequest: RequestHandler = (event) => {
  throw event.redirect(308, "/comercios");
};
