// 1. Allowed origins for your CardDebt project
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://roikodev.github.io"
];

export interface Env {
  MY_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

import { jwtVerify, createRemoteJWKSet } from 'jose';

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