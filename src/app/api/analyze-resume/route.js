import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Simple PDF text extraction using PDF.js via pdf-parse is not bundled here.
// We'll do a two-step approach:
// 1) If resumeUrl is a full http(s) URL, fetch bytes directly.
// 2) If it's a Supabase storage path, resolve public URL and fetch.

async function fetchArrayBuffer(url) {
  const res = await fetch(url, { headers: { Accept: "application/pdf,*/*" } });
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    throw new Error(`Failed to fetch PDF: ${res.status}${body ? ` - ${body.slice(0, 300)}` : ""}`);
  }
  return await res.arrayBuffer();
}

function tryParseSupabasePublicObject(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!u.pathname.includes("/storage/v1/object/public/")) return null;
    const idx = u.pathname.indexOf("/storage/v1/object/public/");
  const after = u.pathname.substring(idx + "/storage/v1/object/public/".length);
  const decoded = decodeURIComponent(after);
  const [bucketName, ...rest] = decoded.split("/");
  const objectPath = rest.join("/");
    if (!bucketName || !objectPath) return null;
    return { bucketName, objectPath };
  } catch {
    return null;
  }
}

async function fetchSupabaseObjectBytes(urlStr) {
  const parsed = tryParseSupabasePublicObject(urlStr);
  if (!parsed) return null;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || (!anon && !service)) return null;
  const supabase = createClient(supaUrl, service || anon);
  const { data, error } = await supabase.storage.from(parsed.bucketName).download(parsed.objectPath);
  if (error || !data) return null;
  const ab = await data.arrayBuffer();
  return ab;
}

async function resolvePublicUrl(path) {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!bucket || !url || !anon) throw new Error("Supabase not configured");
  const supabase = createClient(url, anon);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl;
}

function parseSupabasePublicUrl(candidateUrl) {
  try {
    const u = new URL(candidateUrl);
    // Expected pattern: <project>/storage/v1/object/public/<bucket>/<objectPath>
    const idx = u.pathname.indexOf("/storage/v1/object/public/");
    if (idx === -1) return null;
    const parts = u.pathname.substring(idx + "/storage/v1/object/public/".length).split("/");
    const bucket = decodeURIComponent(parts.shift() || "");
    const objectPath = decodeURIComponent(parts.join("/"));
    if (!bucket || !objectPath) return null;
    return { projectUrl: `${u.protocol}//${u.host}`, bucket, objectPath };
  } catch {
    return null;
  }
}

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Supabase URL missing in env");
  // Prefer service role on server for downloading private objects; fallback to anon
  const key = service || anon;
  if (!key) throw new Error("Supabase key missing in env");
  return createClient(url, key);
}

async function getPdfBytesFromSupabase({ bucket, objectPath }) {
  const supabase = getSupabaseServerClient();
  const normalized = normalizeObjectPath(bucket, objectPath);

  // Construct a few likely variants to tolerate legacy/mis-saved paths
  const variants = new Set([normalized]);
  // If path looks like resumes/<user>/<rest>
  const m = normalized.match(/^resumes\/(user_[^/]+|[^/]+)\/(.+)$/i);
  if (m) {
    const userSeg = m[1];
    const rest = m[2];
    variants.add(`${userSeg}/resumes/${userSeg}/${rest}`);
    variants.add(`resumes/${userSeg}/${userSeg}/${rest}`);
  }
  // If path looks like user_<id>/resumes/<user>/<rest>, also try dropping leading user_<id>
  const n = normalized.match(/^(user_[^/]+)\/resumes\/(user_[^/]+|[^/]+)\/(.+)$/i);
  if (n) {
    const userA = n[1];
    const userB = n[2];
    const rest = n[3];
    variants.add(`resumes/${userB}/${rest}`);
  }

  const tried = [];
  for (const candidate of variants) {
    tried.push(candidate);
    const { data, error } = await supabase.storage.from(bucket).download(candidate);
    if (!error && data) {
      const arr = await data.arrayBuffer();
      return arr;
    }
  }
  throw new Error(
    `Supabase download error: Object not found. Tried paths: ${Array.from(variants).join(", ")} in bucket '${bucket}'`
  );
}

function normalizeObjectPath(bucket, p) {
  let path = (p || "").replace(/^\/+/, "");
  // If the saved path mistakenly starts with the bucket name, strip it
  const prefix = `${bucket}/`;
  if (bucket && path.toLowerCase().startsWith(prefix.toLowerCase())) {
    path = path.slice(prefix.length);
  }
  return path;
}

async function extractPdfText(pdfBuffer) {
  // Dynamically import pdf-parse to avoid bundling issues if not installed yet
  let pdfParse;
  try {
    // eslint-disable-next-line no-undef
  const mod = await import("pdf-parse");
  pdfParse = mod?.default || mod;
  } catch (err) {
  // Surface a controlled error so callers can decide to fall back
  const msg = (err && err.message) || "pdf-parse import failed";
  throw new Error(`PDF extraction unavailable: ${msg}`);
  }
  const result = await pdfParse(Buffer.from(pdfBuffer));
  return result?.text || "";
}

async function callOpenAI({ extractedText, role }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment");

  const text = (extractedText || "").trim();
  const body = text.length
    ? text.slice(0, 15000)
    : "[No text could be extracted from the PDF. It may be image-based or encrypted. Provide general guidance on what information is missing and how the candidate could improve the resume for the role.]";

  const prompt = `You are a resume screening assistant.\n\nResume (plain text, if provided below):\n"""\n${body}\n"""\n\nRole: ${role}\n\nIf a file is attached, read it as the resume content.\n\nTasks:\n1) Summarize the candidate in 3-5 bullets (or explain if text was unavailable).\n2) List 3-5 strengths relevant to the role (or note insufficient data).\n3) List 3-5 gaps/risks (or note insufficient data).\n4) Provide an overall verdict in one short paragraph.`;

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You extract resume text and analyze candidate fit." },
      { role: "user", content: prompt },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

export async function POST(req) {
  try {
  const body = await req.json();
  const resumeUrl = body?.resumeUrl;
  const role = body?.role || "Software Engineer";
  const profileHint = body?.profileHint || "";
    if (!resumeUrl) return NextResponse.json({ error: "Missing resumeUrl" }, { status: 400 });

    let pdfBuffer;
    if (/^https?:\/\//i.test(resumeUrl)) {
      // Supabase URL? Prefer SDK download; fallback to HTTP fetch
      const parsedA = tryParseSupabasePublicObject(resumeUrl) || parseSupabasePublicUrl(resumeUrl);
      if (parsedA) {
        const bucket = parsedA.bucketName || parsedA.bucket;
        const objectPath = parsedA.objectPath;
        try {
          pdfBuffer = await getPdfBytesFromSupabase({ bucket, objectPath });
        } catch (err) {
          // Fallback to HTTP if SDK fails
          pdfBuffer = await fetchArrayBuffer(resumeUrl);
        }
      } else {
        pdfBuffer = await fetchArrayBuffer(resumeUrl);
      }
    } else {
      // Treat as storage path within the configured bucket
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET;
      if (!bucket) throw new Error("NEXT_PUBLIC_SUPABASE_BUCKET not configured");
      const objectPath = normalizeObjectPath(bucket, resumeUrl);
      pdfBuffer = await getPdfBytesFromSupabase({ bucket, objectPath });
    }

  let extractedText = "";
    try {
      extractedText = await extractPdfText(pdfBuffer);
    } catch (exErr) {
      // Unable to extract text; we'll ask the model to explain next steps
      extractedText = "";
    }

    // Call OpenAI for analysis using the extracted text (best-effort)
    let analysis = "";
    try {
      // If no extracted text, prepend profileHint so the model has some context
      const textForModel = extractedText && extractedText.trim()
        ? extractedText
        : profileHint;
      analysis = await callOpenAI({ extractedText: textForModel, role });
    } catch (err) {
      analysis = `Analysis skipped: ${err?.message || 'OpenAI call failed'}`;
    }

    return NextResponse.json({ extractedText, analysis });
  } catch (e) {
    const msg = e?.message || "Unknown error";
    console.error("/api/analyze-resume error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
