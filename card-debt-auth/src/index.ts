// 1. Allowed origins for your CardDebt project
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://roikodev.github.io"
];

export interface Env {
  MY_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SIGNING_SECRET: string;
}

import { jwtVerify, createRemoteJWKSet } from 'jose';

function base64UrlEncode(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  const b64 = btoa(bin)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  return base64UrlEncode(sig)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    // Handle CORS Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[1],
          "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Shared CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[1],
      "Vary": "Origin"
    };

    const url = new URL(request.url);
    const pathname = url.pathname || "/";

    // Signed URL public fetch (no Authorization header).
    if (request.method === "GET" && pathname === "/public") {
      const fileName = url.searchParams.get("file");
      const expRaw = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");
      if (!fileName || !expRaw || !sig) {
        return new Response("Missing parameters", { status: 400, headers: corsHeaders });
      }

      const exp = Number(expRaw)
      if (!Number.isFinite(exp)) {
        return new Response("Invalid exp", { status: 400, headers: corsHeaders });
      }
      const now = Math.floor(Date.now() / 1000)
      if (exp < now) {
        return new Response("Expired", { status: 401, headers: corsHeaders });
      }

      const secret = env.SIGNING_SECRET?.trim()
      if (!secret) {
        return new Response("Signing not configured", { status: 500, headers: corsHeaders });
      }

      const msg = `${fileName}:${exp}`
      const expected = await hmacSha256Base64Url(secret, msg)
      if (sig !== expected) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      const object = await env.MY_BUCKET.get(fileName);
      if (!object) return new Response("File not found", { status: 404, headers: corsHeaders });

      const headers = new Headers(corsHeaders);
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "private, max-age=300");
      return new Response(object.body, { headers });
    }

    const fileName = url.searchParams.get("file");
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token || !fileName) {
      return new Response("Missing parameters", { status: 400, headers: corsHeaders });
    }

    try {
      // 2. Verify Supabase JWT
      const JWKS = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${env.SUPABASE_URL}/auth/v1`,
        audience: 'authenticated',
      });

      // 3. Security Check: Ensure user only accesses their own "folder"
      const userId = payload.sub as string;
      if (!fileName.startsWith(userId)) {
        return new Response("Forbidden: Access Denied", { status: 403, headers: corsHeaders });
      }

      // --- SIGNED URL (GET) ---
      // Returns a short-lived public URL that can be used as <img src="..."> without headers.
      if (request.method === "GET" && pathname === "/signed") {
        const secret = env.SIGNING_SECRET?.trim()
        if (!secret) {
          return new Response("Signing not configured", { status: 500, headers: corsHeaders });
        }

        const ttlSecRaw = url.searchParams.get("ttl");
        const ttlSec = Math.max(
          10,
          Math.min(60 * 10, ttlSecRaw ? Number(ttlSecRaw) : 60 * 5)
        )
        const now = Math.floor(Date.now() / 1000)
        const exp = now + (Number.isFinite(ttlSec) ? ttlSec : 60 * 5)
        const msg = `${fileName}:${exp}`
        const sig = await hmacSha256Base64Url(secret, msg)

        const publicUrl = new URL(request.url)
        publicUrl.pathname = "/public"
        publicUrl.search = ""
        publicUrl.searchParams.set("file", fileName)
        publicUrl.searchParams.set("exp", String(exp))
        publicUrl.searchParams.set("sig", sig)

        const body = JSON.stringify({ url: publicUrl.toString(), exp })
        return new Response(body, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // --- UPLOAD (PUT) ---
      if (request.method === "PUT") {
        await env.MY_BUCKET.put(fileName, request.body);
        return new Response("Upload successful", { status: 201, headers: corsHeaders });
      }

      // --- DOWNLOAD (GET) ---
      if (request.method === "GET") {
        const object = await env.MY_BUCKET.get(fileName);
        if (!object) return new Response("File not found", { status: 404, headers: corsHeaders });
        
        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        return new Response(object.body, { headers });
      }

      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    } catch (e) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
  },
};