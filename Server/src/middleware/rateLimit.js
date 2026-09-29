/** In-memory sliding-window rate limiter. */

const buckets = new Map();

// Prune expired rate limit buckets
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
