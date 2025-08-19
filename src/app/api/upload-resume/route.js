import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const userId = form.get("userId") || "anonymous";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "job-board-public";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const bytes = Buffer.from(await file.arrayBuffer());
    const original = file.name || `resume.pdf`;
    const ext = (original.split(".").pop() || "pdf").toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const objectPath = `resumes/${userId}/${uniqueName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, bytes, {
        cacheControl: "3600",
        upsert: true,
        contentType: "application/pdf",
      });

    if (error) {
      return NextResponse.json({ error: error.message, status: error.status || 500 }, { status: error.status || 500 });
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(objectPath);

    const publicUrl = publicData?.publicUrl || objectPath;
    return NextResponse.json({ success: true, publicUrl, path: objectPath });
  } catch (e) {
    const message = e?.message || "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
