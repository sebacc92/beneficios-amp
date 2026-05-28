import type { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async (event) => {
  throw event.redirect(302, "/admin/stats/");
};
