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
      
      console.log('Starting analysis with:', {
        resumeUrl: resumeUrl,
        candidateId: candidateProfile?.userId,
        profileHint: profileHint.substring(0, 200) + '...'
      });
      
      const resp = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resumeUrl, 
          candidateId: candidateProfile?.userId,
          role: "Generic Role", 
          profileHint 
        }),
      });
      const json = await resp.json();
      console.log('Analysis response:', json);
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
          {resumeUrl && (
            <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded mt-2">
              Resume URL: {resumeUrl}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!resumeUrl && (
            <div className="text-sm text-red-600">No resume found for this candidate.</div>
          )}
          {error && (
            <div className="text-sm text-red-600 mb-4 p-4 border border-red-200 bg-red-50 rounded">
              <div className="font-semibold">Error:</div>
              <div>{error}</div>
              {result?.debugInfo && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-red-600 font-semibold">
                    📋 Debug Information
                  </summary>
                  <div className="mt-2 space-y-2 text-xs">
                    <div><strong>Bucket:</strong> {result.debugInfo.bucket}</div>
                    <div><strong>Candidate ID:</strong> {result.debugInfo.candidateId}</div>
                    <div><strong>Original URL:</strong> {result.debugInfo.originalUrl}</div>
                    {result.debugInfo.filesFound && (
                      <div>
                        <strong>Files found for user:</strong>
                        <pre className="bg-gray-100 p-2 mt-1 rounded">{JSON.stringify(result.debugInfo.filesFound, null, 2)}</pre>
                      </div>
                    )}
                    {result.debugInfo.resumeFilesFound && (
                      <div>
                        <strong>Resume files found:</strong>
                        <pre className="bg-gray-100 p-2 mt-1 rounded">{JSON.stringify(result.debugInfo.resumeFilesFound, null, 2)}</pre>
                      </div>
                    )}
                    <details>
                      <summary className="cursor-pointer">All Download Attempts</summary>
                      <pre className="bg-gray-100 p-2 mt-1 rounded overflow-auto max-h-40">
{result.debugInfo.attempts?.map((attempt, i) => 
`${i+1}. ${attempt.path} - ${attempt.success ? '✅' : '❌'} ${attempt.error || ''}`
).join('\n')}
                      </pre>
                    </details>
                  </div>
                </details>
              )}
            </div>
          )}
          {loading && <div className="text-sm">Analyzing resume…</div>}
          {result && (
            <div className="space-y-4">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Extracted Text 
                  {result.pdfParseSuccess ? (
                    <span className="text-green-600 text-sm">✅ PDF parsed successfully</span>
                  ) : (
                    <span className="text-red-600 text-sm">❌ PDF parsing failed</span>
                  )}
                  {result.fullTextLength > 0 && (
                    <span className="text-gray-500 text-sm">({result.fullTextLength} total chars)</span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded border max-h-64 overflow-auto">
                  {result?.extractedText || "No text extracted from PDF"}
                </pre>
              </div>
              <div>
                <div className="font-semibold">AI Fit Analysis</div>
                <div className="text-sm whitespace-pre-wrap">{result?.analysis || ""}</div>
              </div>
              {result.debugInfo && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600">🔍 Technical Details</summary>
                  <pre className="text-xs bg-gray-50 p-3 mt-2 rounded overflow-auto">
                    {JSON.stringify(result.debugInfo, null, 2)}
                  </pre>
                </details>
              )}
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
