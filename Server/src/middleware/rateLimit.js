/**
 * Dependency-free sliding-window rate limiter (P1-1).
 *
 * Caps how many requests a single IP can make to a route group inside a time
 * window. State lives in memory (per process); for a multi-instance deployment
 * replace with a shared store (e.g. Redis). Answers 429 with a JSON message
 * and standard X-RateLimit-* headers when the cap is exceeded.
 */

const buckets = new Map();

// Prune stale buckets once a minute so the map cannot grow without bound.
// unref() keeps this timer from holding the process open on its own.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > bucket.windowMs) buckets.delete(key);
  }
}, 60 * 1000).unref();

const rateLimit =
  ({ windowMs, max, name = "default" }) =>
  (req, res, next) => {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || "unknown";
    const key = `${name}:${ip}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0, windowMs };
    }
    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res
        .status(429)
        .json({ message: "Too many requests. Please try again later." });
    }

    return next();
  };

module.exports = rateLimit;
