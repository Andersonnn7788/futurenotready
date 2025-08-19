"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";

export default function AnalyzeClient({ candidateProfile }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const resumeUrl = useMemo(() => candidateProfile?.candidateInfo?.resume || "", [candidateProfile]);

  async function runAnalysis() {
    try {
      setLoading(true);
      setError("");
      setResult(null);
      const ci = candidateProfile?.candidateInfo || {};
      const profileHint = [
        ci.name && `Name: ${ci.name}`,
        ci.email && `Email: ${ci.email}`,
        ci.phoneNumber && `Phone: ${ci.phoneNumber}`,
        ci.preferedJobLocation && `Location: ${ci.preferedJobLocation}`,
        ci.totalExperience && `Experience: ${ci.totalExperience}`,
        ci.skills && `Skills: ${ci.skills}`,
        ci.college && `Education: ${ci.college} (${ci.graduatedYear || ''})`,
        ci.linkedinProfile && `LinkedIn: ${ci.linkedinProfile}`,
        ci.githubProfile && `GitHub: ${ci.githubProfile}`,
      ].filter(Boolean).join("\n");
      const resp = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl, role: "Generic Role", profileHint }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Analysis failed");
      setResult(json);
    } catch (e) {
      setError(e?.message || "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (resumeUrl) runAnalysis();
  }, [resumeUrl]);

  return (
    <div className="mx-auto max-w-5xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Resume Analysis</CardTitle>
          <div className="text-sm text-gray-500">Candidate: {candidateProfile?.candidateInfo?.name || "N/A"}</div>
        </CardHeader>
        <CardContent>
          {!resumeUrl && (
            <div className="text-sm text-red-600">No resume found for this candidate.</div>
          )}
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          {loading && <div className="text-sm">Analyzing resume…</div>}
          {result && (
            <div className="space-y-4">
              <div>
                <div className="font-semibold">Extracted Text (truncated)</div>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded border max-h-64 overflow-auto">
                  {result?.extractedText?.slice(0, 2000) || ""}
                </pre>
              </div>
              <div>
                <div className="font-semibold">AI Fit Analysis</div>
                <div className="text-sm whitespace-pre-wrap">{result?.analysis || ""}</div>
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>Back</Button>
            <Button onClick={runAnalysis} disabled={!resumeUrl || loading}>Re-run Analysis</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
