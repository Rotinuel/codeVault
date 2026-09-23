import mongoose from "mongoose";

const { Schema } = mongoose;

// Fixed-window rate-limit counters. Stored in MongoDB so limits hold across
// serverless instances (in-memory counters do not work reliably on Vercel).
const RateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimit || mongoose.model("RateLimit", RateLimitSchema);
