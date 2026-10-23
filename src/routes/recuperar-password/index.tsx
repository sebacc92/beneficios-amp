import type { RequestHandler } from "@builder.io/qwik-city";

/**
 * Members have no password, so the old "recover password" page became the member login
 * help. Old links and bookmarks land there; admins have their own flow in the panel.
 */
export const onRequest: RequestHandler = (event) => {
  throw event.redirect(301, "/ayuda-ingreso/");
};
