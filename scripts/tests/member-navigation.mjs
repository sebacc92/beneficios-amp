/** Member navigation helpers; no database, browser or network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const compiled = await build({
  entryPoints: [resolve(root, "src/utils/return-path.ts")],
  bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent",
});
const paths = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

let checked = 0;
function test(name, run) {
  run();
  checked++;
  console.log(`PASS ${name}`);
}
const origin = "https://beneficios.example";

test("return paths reject other origins, browser control characters and login loops", () => {
  for (const raw of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/foo\\bar", "/login/", "/beneficio/../login/?volver=/perfil/", "/a/..//evil.example"]) {
    assert.equal(paths.safeReturnPath(raw), null, JSON.stringify(raw));
    assert.equal(paths.loginUrl(raw), "/login/");
    assert.equal(paths.loginHelpUrl(raw), "/ayuda-ingreso/");
  }
  assert.equal(paths.safeReturnPath(" /beneficio/otro/../cafe/?tipo=2#detalle "), "/beneficio/cafe/?tipo=2#detalle");
});

test("login → help → login helpers keep the original benefit, catalog filters and anchor", () => {
  const destination = "/beneficio/cafe/?resultados=%2Fbeneficios%2F%3Fbuscar%3Dcaf%25C3%25A9%26categoria%3D2#obtener-cupon";
  const firstLogin = new URL(paths.loginUrl(destination), origin);
  const returnPath = paths.safeReturnPath(firstLogin.searchParams.get(paths.RETURN_PARAM));
  const helpUrl = new URL(paths.loginHelpUrl(returnPath), origin);
  assert.equal(helpUrl.pathname, "/ayuda-ingreso/");
  const helpReturnPath = paths.safeReturnPath(helpUrl.searchParams.get(paths.RETURN_PARAM));
  const secondLogin = new URL(paths.loginUrl(helpReturnPath), origin);
  assert.equal(secondLogin.pathname, "/login/");
  assert.equal(paths.safeReturnPath(secondLogin.searchParams.get(paths.RETURN_PARAM)), destination);
});

test("help opened directly or with an external return always leads to the local login", () => {
  for (const raw of [null, "//evil.example", "/\t/evil.example", "https://evil.example", "/login/"]) {
    const url = new URL("/ayuda-ingreso/", origin);
    if (raw !== null) url.searchParams.set(paths.RETURN_PARAM, raw);
    const returnPath = paths.safeReturnPath(url.searchParams.get(paths.RETURN_PARAM));
    assert.equal(paths.loginUrl(returnPath), "/login/");
  }
});

test("admin destinations remain inside the panel after path normalization", () => {
  assert.equal(paths.safeAdminReturnPath("/admin/benefits/?buscar=cafe"), "/admin/benefits/?buscar=cafe");
  for (const raw of ["/perfil/", "/administrator/", "/admin/../perfil/", "/admin/a/../login/", "/admin/cambiar-password/", "/admin/../..//evil.example"]) {
    assert.equal(paths.safeAdminReturnPath(raw), null, raw);
  }
});

console.log(`${checked}/${checked} checks passed; no database, browser or network.`);
