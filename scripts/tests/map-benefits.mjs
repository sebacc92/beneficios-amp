/** Run with `node scripts/tests/map-benefits.mjs`. Pure calculations, no network or database. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { outputFiles } = await build({
  entryPoints: [resolve(root, "src/utils/map-benefits.ts")],
  tsconfig: resolve(root, "tsconfig.json"),
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const {
  parseCoordinates,
  distanceKm,
  formatDistance,
  filterMapBenefits,
  rankMapBenefits,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`
);

for (const [description, latitude, longitude] of [
  ["null", null, -58],
  ["undefined", undefined, -58],
  ["empty string", "", -58],
  ["whitespace", " ", -58],
  ["non-number", "NaN", -58],
  ["infinity", "Infinity", 0],
  ["latitude outside Earth", 91, 0],
  ["longitude outside Earth", 0, -181],
  ["boolean", false, 0],
  ["array", [], 1],
])
  test(`coordinates reject ${description}`, () =>
    assert.equal(parseCoordinates(latitude, longitude), null));

test("zero coordinates are valid", () =>
  assert.deepEqual(parseCoordinates("0", "0"), { latitude: 0, longitude: 0 }));
test("coordinate strings allow surrounding whitespace", () =>
  assert.deepEqual(parseCoordinates(" -34.92 ", "-57.95"), {
    latitude: -34.92,
    longitude: -57.95,
  }));
test("geographic coordinate boundaries are valid", () =>
  assert.deepEqual(parseCoordinates(-90, 180), {
    latitude: -90,
    longitude: 180,
  }));
const laPlata = { latitude: -34.9214, longitude: -57.9545 };
const buenosAires = { latitude: -34.6037, longitude: -58.3816 };
test("distance to the same place is zero", () =>
  assert.equal(distanceKm(laPlata, laPlata), 0));
test("La Plata to Buenos Aires is about 53 km in a straight line", () =>
  assert.ok(
    distanceKm(laPlata, buenosAires) > 52 &&
      distanceKm(laPlata, buenosAires) < 54,
  ));
test("distance is symmetric", () =>
  assert.ok(
    Math.abs(
      distanceKm(laPlata, buenosAires) - distanceKm(buenosAires, laPlata),
    ) < 0.00001,
  ));
test("antipodal distance remains finite", () =>
  assert.ok(
    Math.abs(
      distanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 180 },
      ) - 20015,
    ) < 1,
  ));
test("short distances use meters", () =>
  assert.equal(formatDistance(0.42), "420 m"));
test("kilometers use Argentine decimal notation", () =>
  assert.equal(formatDistance(1.26), "1,3 km"));

const fixture = (id, titulo, latitude, categorias, ubicacion, ofertas) => ({
  id,
  titulo,
  descripcion: "Promoción para socios",
  latitud: latitude,
  longitud: "-57.95",
  categorias: categorias.map(([id, descripcion]) => ({ id, descripcion })),
  ubicacion: ubicacion.map(([id, descripcion]) => ({ id, descripcion })),
  ofertas: ofertas.map(([id, descripcion]) => ({ id, descripcion })),
});
const benefits = [
  fixture(
    1,
    "Café Uno",
    "-34.92",
    [[1, "Gastronomía"]],
    [[2, "La Plata"]],
    [[5, "10%"]],
  ),
  fixture(
    2,
    "Club Salud",
    "-34.93",
    [[3, "Gimnasios"]],
    [[4, "Gonnet"]],
    [[6, "20%"]],
  ),
  fixture(
    3,
    "Sin ubicación",
    "",
    [[1, "Gastronomía"]],
    [[2, "La Plata"]],
    [[5, "10%"]],
  ),
];
const ids = (values) => values.map((benefit) => benefit.id);
test("search ignores accents in merchant names", () =>
  assert.deepEqual(ids(filterMapBenefits(benefits, "cafe", null, null)), [1]));
test("search matches localities without case sensitivity", () =>
  assert.deepEqual(ids(filterMapBenefits(benefits, "GONNET", null, null)), [
    2,
  ]));
test("search and category and locality combine", () =>
  assert.deepEqual(ids(filterMapBenefits(benefits, "gastronomia", 1, 2)), [1]));
test("incompatible category and locality return no results", () =>
  assert.deepEqual(filterMapBenefits(benefits, "", 1, 4), []));
test("unfiltered results exclude invalid coordinates", () =>
  assert.deepEqual(ids(filterMapBenefits(benefits, "", null, null)), [1, 2]));
test("unknown query returns no results", () =>
  assert.deepEqual(filterMapBenefits(benefits, "no existe", null, null), []));
test("discount combines with other filters", () => {
  assert.deepEqual(ids(filterMapBenefits(benefits, "", null, null, 6)), [2]);
  assert.deepEqual(filterMapBenefits(benefits, "", 1, 2, 6), []);
});
test("nearest merchants come first without mutating the source", () => {
  const available = filterMapBenefits(benefits, "", null, null);
  assert.deepEqual(
    rankMapBenefits(available, { latitude: -34.93, longitude: -57.95 }).map(
      (item) => item.benefit.id,
    ),
    [2, 1],
  );
  assert.deepEqual(ids(available), [1, 2]);
});
test("without permission original ordering remains and distances are absent", () => {
  assert.deepEqual(
    rankMapBenefits(benefits.slice(0, 2), null).map((item) => [
      item.benefit.id,
      item.distance,
    ]),
    [
      [1, null],
      [2, null],
    ],
  );
});
test("equal-distance merchants have a stable ID ordering", () => {
  const identical = [benefits[1], { ...benefits[1], id: 0 }];
  assert.deepEqual(
    rankMapBenefits(identical, laPlata).map((item) => item.benefit.id),
    [0, 2],
  );
});
