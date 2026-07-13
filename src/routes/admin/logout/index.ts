import type { RequestHandler } from "@builder.io/qwik-city";
import { ADMIN_SESSION_COOKIE } from "~/server/admin-auth";

export const onGet: RequestHandler = async ({ cookie, redirect }) => {
  cookie.delete(ADMIN_SESSION_COOKIE, { path: "/" });
  throw redirect(302, "/admin/login");
};
