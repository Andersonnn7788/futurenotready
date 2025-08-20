import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Supabase URL missing in env");
  const key = service || anon;
  if (!key) throw new Error("Supabase key missing in env");
  return createClient(url, key);
}

async function extractPdfText(pdfBuffer) {
  console.log(`🔍 Starting PDF text extraction from ${pdfBuffer.length} byte buffer`);
  
  // Check if it's a valid PDF
  const pdfHeader = pdfBuffer.slice(0, 8).toString('ascii');
  console.log(`📄 PDF header: "${pdfHeader}"`);
  
  if (!pdfHeader.startsWith('%PDF-')) {
    throw new Error(`Invalid PDF header: ${pdfHeader}`);
  }

  // Method 1: Try system-installed pdftotext directly (most reliable)
  try {
    console.log("🚀 Method 1: Trying system pdftotext...");
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    // Create temp directory
    const tmpDir = path.join(os.tmpdir(), 'pdf-text-extraction');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPdfPath = path.join(tmpDir, `temp-${Date.now()}.pdf`);
    const tmpTextPath = path.join(tmpDir, `extracted-${Date.now()}.txt`);
    
    try {
      // Write PDF to temp file
      await fs.writeFile(tmpPdfPath, pdfBuffer);
      console.log(`📁 Created temp PDF: ${tmpPdfPath}`);
      
      // Try pdftotext command with various encoding options
      const commands = [
        `pdftotext -enc UTF-8 -layout "${tmpPdfPath}" "${tmpTextPath}"`,
        `pdftotext -layout "${tmpPdfPath}" "${tmpTextPath}"`,
        `pdftotext -raw "${tmpPdfPath}" "${tmpTextPath}"`,
        `pdftotext "${tmpPdfPath}" "${tmpTextPath}"`
      ];
      
      for (const command of commands) {
        try {
          console.log(`🔍 Trying command: ${command}`);
          await execAsync(command, { timeout: 10000 });
          
          // Read the extracted text
          const extractedText = await fs.readFile(tmpTextPath, 'utf8');
          
          if (extractedText.trim().length > 20) {
            console.log(`✅ System pdftotext successful: ${extractedText.length} characters`);
            console.log(`📝 Sample: "${extractedText.substring(0, 200)}..."`);
            
            // Clean up
            await fs.rm(tmpDir, { recursive: true, force: true });
            return extractedText.trim();
          }
        } catch (cmdError) {
          console.log(`⚠️ Command failed: ${cmdError.message}`);
        }
      }
      
      // Clean up
      await fs.rm(tmpDir, { recursive: true, force: true });
      
    } catch (fileError) {
      console.log(`❌ File operation error: ${fileError.message}`);
    }
    
  } catch (systemPdftotextError) {
    console.log(`❌ System pdftotext method failed: ${systemPdftotextError.message}`);
  }

  // Method 2: Try pdf2json (alternative reliable parser)
  try {
    console.log("🚀 Method 2: Trying pdf2json...");
    const PDFParser = require('pdf2json');
    
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);
      
      pdfParser.on("pdfParser_dataError", errData => {
        console.log(`❌ pdf2json error: ${errData.parserError}`);
        reject(new Error(errData.parserError));
      });
      
      pdfParser.on("pdfParser_dataReady", pdfData => {
        try {
          let extractedText = '';
          
          console.log(`📊 PDF structure debug:`, {
            hasFormImage: !!pdfData.formImage,
            hasPages: !!(pdfData.formImage && pdfData.formImage.Pages),
            pageCount: pdfData.formImage?.Pages?.length || 0
          });
          
          // Extract text from all pages
          if (pdfData.formImage && pdfData.formImage.Pages) {
            for (let pageIndex = 0; pageIndex < pdfData.formImage.Pages.length; pageIndex++) {
              const page = pdfData.formImage.Pages[pageIndex];
              
              console.log(`📄 Page ${pageIndex + 1} debug:`, {
                hasTexts: !!(page.Texts && page.Texts.length > 0),
                textCount: page.Texts?.length || 0
              });
              
              if (page.Texts && page.Texts.length > 0) {
                // Sort texts by position for better reading order
                const sortedTexts = page.Texts.sort((a, b) => {
                  const yDiff = b.y - a.y; // Sort by Y position (top to bottom)
                  if (Math.abs(yDiff) > 0.5) return yDiff;
                  return a.x - b.x; // Then by X position (left to right)
                });
                
                for (const textObj of sortedTexts) {
                  if (textObj.R && textObj.R.length > 0) {
                    for (const run of textObj.R) {
                      if (run.T) {
                        // Try multiple decoding approaches
                        let decodedText = '';
                        
                        try {
                          // First try URI decoding
                          decodedText = decodeURIComponent(run.T);
                        } catch (decodeError) {
                          // If URI decoding fails, use the text as-is
                          decodedText = run.T;
                        }
                        
                        // Clean up common encoding issues
                        decodedText = decodedText
                          .replace(/%20/g, ' ')
                          .replace(/%2C/g, ',')
                          .replace(/%2E/g, '.')
                          .replace(/%3A/g, ':')
                          .replace(/%3B/g, ';')
                          .replace(/%28/g, '(')
                          .replace(/%29/g, ')')
                          .replace(/%2D/g, '-')
                          .replace(/%2F/g, '/')
                          .replace(/%40/g, '@')
                          .replace(/\s+/g, ' ')
                          .trim();
                        
                        console.log(`🔤 Raw text: "${run.T}" → Decoded: "${decodedText}"`);
                        
                        if (decodedText.length > 0) {
                          extractedText += decodedText + ' ';
                        }
                      }
                    }
                  }
                }
                extractedText += '\n\n'; // Add page break
              } else {
                console.log(`⚠️ Page ${pageIndex + 1} has no text objects`);
              }
            }
          } else {
            console.log(`❌ PDF has no readable page structure`);
            console.log(`📊 Full PDF data keys:`, Object.keys(pdfData));
            if (pdfData.formImage) {
              console.log(`📊 FormImage keys:`, Object.keys(pdfData.formImage));
            }
          }
          
          // Clean up the final text
          extractedText = extractedText
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
          
          console.log(`✅ pdf2json extraction result: ${extractedText.length} characters`);
          console.log(`📝 Sample: "${extractedText.substring(0, 200)}..."`);
          
          if (extractedText.length > 20) {
            resolve(extractedText);
          } else {
            reject(new Error('No readable text found in PDF'));
          }
          
        } catch (parseError) {
          console.log(`❌ pdf2json parsing error: ${parseError.message}`);
          reject(parseError);
        }
      });
      
      // Parse the PDF buffer
      pdfParser.parseBuffer(pdfBuffer);
      
      // Set timeout
      setTimeout(() => {
        reject(new Error('PDF parsing timeout'));
      }, 30000); // 30 second timeout
    });
    
  } catch (pdf2jsonError) {
    console.log(`❌ pdf2json failed: ${pdf2jsonError.message}`);
  }

  // If we get here, none of the extraction methods worked
  const helpfulMessage = `Unable to extract text from PDF using multiple methods:
  
1. System pdftotext - command line extraction
2. pdf2json - JSON-based parser

This may indicate:
- The PDF uses unsupported encoding or font embedding
- The PDF is password protected or corrupted
- The required system dependencies are missing

The PDF was downloaded successfully (${pdfBuffer.length} bytes) but text extraction failed with all available methods.`;

  throw new Error(helpfulMessage);
}

async function callOpenAI({ extractedText, role }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment");

  const text = (extractedText || "").trim();
  const body = text.length
    ? text.slice(0, 15000)
    : "[No text could be extracted from the PDF. It may be image-based or encrypted. Provide general guidance on what information is missing and how the candidate could improve the resume for the role.]";

  const prompt = `You are a resume screening assistant.

Resume (plain text, if provided below):
"""
${body}
"""

Role: ${role}

If a file is attached, read it as the resume content.

Tasks:

Summarize the candidate in 3–5 bullets (or explain if text was unavailable).

List 3–5 strengths relevant to the role (or note insufficient data).

List 3–5 gaps/risks (or note insufficient data).

Provide an overall verdict in one short paragraph.

Add a Score Matching section where you rate how well the candidate fits the role on a scale of 1–10, with short justification.

Add a Retention section where you assess the likelihood of the candidate staying long-term (High risk, Moderate risk, or Low risk), with reasoning.

Output Formatting Requirements:

Present each category inside a visually distinct box-like section with a clear title.

Titles should be styled (e.g., bold or heading style) without showing raw markdown symbols like ** or ###.

Each box should clearly separate content for readability, as if displayed in a UI card or container.

The final output should contain the following boxes in order:

Candidate Summary

Strengths

Gaps/Risks

Overall Verdict

Score Matching

Retention`;

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You are a resume screening assistant. Format your response with clear section titles and structured content, but do not use markdown symbols. Present each section as if it's in a styled UI container with bold headings." },
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
    const rawCandidateId = body?.candidateId;
    const candidateId = rawCandidateId?.startsWith("user_")
      ? rawCandidateId.slice(5)
      : rawCandidateId;
    const role = body?.role || "Software Engineer";
    const profileHint = body?.profileHint || "";
    
    console.log('=== RESUME ANALYSIS DEBUG ===');
    console.log('Input resumeUrl:', resumeUrl);
    console.log('CandidateId:', candidateId);
    console.log('Role:', role);
    
    if (!resumeUrl) return NextResponse.json({ error: "Missing resumeUrl" }, { status: 400 });

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "talentmatch";
    const supabase = getSupabaseServerClient();
    
    // Extract object path from URL
    let objectPath;
    if (/^https?:\/\//i.test(resumeUrl)) {
      const urlParts = resumeUrl.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        const pathWithBucket = urlParts[1].split('?')[0];
        objectPath = pathWithBucket.startsWith(`${bucket}/`) 
          ? pathWithBucket.substring(`${bucket}/`.length)
          : pathWithBucket;
      }
    } else {
      objectPath = resumeUrl.startsWith(`${bucket}/`) 
        ? resumeUrl.substring(`${bucket}/`.length)
        : resumeUrl;
    }

    console.log('Extracted object path:', objectPath);

    // Download PDF from Supabase
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(objectPath);
    
    if (error || !data) {
      return NextResponse.json({
        error: 'Failed to download PDF from Supabase Storage',
        details: error?.message || 'File not found',
        suggestion: "Check the file path in Supabase Storage console."
      }, { status: 404 });
    }

    const pdfBuffer = Buffer.from(await data.arrayBuffer());
    console.log(`✅ Downloaded PDF: ${pdfBuffer.length} bytes`);

    // Extract text from PDF
    let extractedText = "";
    let pdfParseSuccess = false;
    
    try {
      console.log('🔍 Starting PDF text extraction...');
      extractedText = await extractPdfText(pdfBuffer);
      pdfParseSuccess = !!extractedText && extractedText.trim().length > 0;
      console.log(`✅ PDF extraction result: ${extractedText.length} characters`);
      
    } catch (pdfError) {
      console.error('❌ PDF parsing failed:', pdfError.message);
      extractedText = "";
    }

    // Call OpenAI for analysis
    let analysis = "";
    try {
      const textForModel = extractedText && extractedText.trim()
        ? extractedText
        : profileHint;
      analysis = await callOpenAI({ extractedText: textForModel, role });
    } catch (err) {
      analysis = `Analysis skipped: ${err?.message || 'OpenAI call failed'}`;
    }

    return NextResponse.json({ 
      extractedText: extractedText.substring(0, 3000),
      fullTextLength: extractedText.length,
      analysis,
      pdfParseSuccess,
      debugInfo: {
        objectPath,
        fileSize: pdfBuffer?.length,
        textExtracted: extractedText.length > 0
      }
    });
  } catch (e) {
    const msg = e?.message || "Unknown error";
    console.error("/api/analyze-resume error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
