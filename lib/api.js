import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { assertSameOrigin } from "./request.js";

/** Error type thrown by services and authorization helpers; mapped to JSON responses. */
export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.extra = extra;
  }
}

export const Errors = {
  unauthorized: (msg = "Authentication required") => new ApiError(401, msg, { code: "UNAUTHORIZED" }),
  forbidden: (msg = "You do not have permission to perform this action") =>
    new ApiError(403, msg, { code: "FORBIDDEN" }),
  notFound: (msg = "Resource not found") => new ApiError(404, msg, { code: "NOT_FOUND" }),
  badRequest: (msg = "Invalid request", extra = {}) => new ApiError(400, msg, { code: "BAD_REQUEST", ...extra }),
  conflict: (msg = "Conflict") => new ApiError(409, msg, { code: "CONFLICT" }),
  subscriptionRequired: (msg = "Subscription required") =>
    new ApiError(402, msg, { code: "SUBSCRIPTION_REQUIRED" }),
  tooMany: (msg = "Too many requests. Please try again later.", retryAfter) =>
    new ApiError(429, msg, { code: "RATE_LIMITED", retryAfter }),
};

const NO_STORE = { "Cache-Control": "no-store" };

export function ok(data = {}, init = {}) {
  const { status = 200, message, headers } = init;
  return NextResponse.json(
    { success: true, ...(message ? { message } : {}), data },
    { status, headers: { ...NO_STORE, ...(headers || {}) } }
  );
}

export function fail(message, status = 400, extra = {}) {
  const headers = { ...NO_STORE };
  if (extra.retryAfter) headers["Retry-After"] = String(extra.retryAfter);
  return NextResponse.json({ success: false, message, ...extra }, { status, headers });
}

function formatZodIssues(error) {
  const errors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function toErrorResponse(error) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.extra);
  }
  if (error instanceof ZodError) {
    const errors = formatZodIssues(error);
    const first = Object.values(errors)[0];
    return fail(first || "Validation failed", 422, { code: "VALIDATION_ERROR", errors });
  }
  if (error?.name === "ValidationError" && error.errors) {
    const errors = {};
    for (const [k, v] of Object.entries(error.errors)) errors[k] = v.message;
    return fail("Validation failed", 422, { code: "VALIDATION_ERROR", errors });
  }
  if (error?.name === "CastError") {
    return fail("Invalid identifier", 400, { code: "BAD_REQUEST" });
  }
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "field";
    return fail(`A record with this ${field} already exists`, 409, { code: "DUPLICATE" });
  }
  // Never leak internals (stack traces, connection strings) to clients.
  console.error("[api] Unhandled error:", error);
  return fail("Something went wrong. Please try again.", 500, { code: "SERVER_ERROR" });
}

/**
 * Wraps a route handler with consistent error handling.
 * Usage: export const GET = withApi(async (request, ctx) => ok({...}))
 */
export function withApi(handler) {
  return async function wrapped(request, context) {
    try {
      if (!assertSameOrigin(request)) {
        throw new ApiError(403, "Cross-origin request blocked", { code: "CSRF" });
      }
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Parse and validate a JSON body against a zod schema. */
export async function parseBody(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw Errors.badRequest("Request body must be valid JSON");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw Errors.badRequest("Request body must be a JSON object");
  }
  return schema.parse(body);
}

/** Parse query-string params with a zod schema. */
export function parseQuery(request, schema) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  return schema.parse(raw);
}

export async function getRouteId(context, key = "id") {
  const params = await context.params;
  const value = params?.[key];
  if (!value || !/^[a-f0-9]{24}$/i.test(String(value))) throw Errors.badRequest("Invalid identifier");
  return String(value);
}

/** Build pagination metadata. */
export function pageMeta(page, limit, total) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
