/** Janela fixa com armazenamento limitado. Não usa IDs fornecidos pelo cliente. */
export class RateLimit {
  private readonly buckets = new Map<string, { count: number; until: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) {
      for (const [id, value] of this.buckets) if (value.until <= now) this.buckets.delete(id);
      if (this.buckets.size >= 1024 && !this.buckets.has(key)) return false;
      bucket = { count: 0, until: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    return ++bucket.count <= this.limit;
  }
}
