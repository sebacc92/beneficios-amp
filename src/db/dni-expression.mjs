// Keep SQL normalization identical to /[.\s]/g in utils/dni.ts. The same
// expression must be used by lookups and the index for SQLite to use the index.
const separators = [
  46, 9, 10, 11, 12, 13, 32, 160, 5760,
  ...Array.from({ length: 11 }, (_, index) => 8192 + index),
  8232, 8233, 8239, 8287, 12288, 65279,
];

export const normalizedDniExpression = separators.reduce(
  (expression, code) => `replace(${expression}, char(${code}), '')`,
  '"numero_socio"',
);

// Non-unique: existing equivalent identifiers must remain detectable so login
// can refuse ambiguous identities without changing or deleting historical data.
export const normalizedDniIndexSql =
  `CREATE INDEX IF NOT EXISTS idx_users_dni_normalized ON users (${normalizedDniExpression})`;
