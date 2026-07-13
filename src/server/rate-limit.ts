/**
 * Rate limiter en memoria (token bucket por clave). Best-effort: el estado vive
 * por instancia/isolate, así que no es un límite global perfecto en serverless,
 * pero corta el abuso básico (fuerza bruta en el login del admin) sin
 * infraestructura extra. Para límites estrictos, mover a Upstash/Redis.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    // Limpieza oportunista para que el Map no crezca sin control.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    }
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

/** Extrae una IP de cliente razonable desde los headers (Vercel/proxies). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
