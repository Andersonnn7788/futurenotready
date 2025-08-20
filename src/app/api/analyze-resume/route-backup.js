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
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPdfPath = path.join(tmpDir, `temp-${Date.now()}.pdf`);
    
    try {
      // Write PDF to temp file
      await fs.writeFile(tmpPdfPath, pdfBuffer);
      console.log(`� Created temp PDF: ${tmpPdfPath}`);
      
      // Extract text using poppler
      const options = {
        format: 'text', // output format
        out_dir: tmpDir, // output directory
        out_prefix: 'extracted', // output file prefix
        page: null, // convert all pages
        first_page: undefined, // first page to convert
        last_page: undefined, // last page to convert
        with_layout: true, // maintain layout
        raw_dates: true, // keep raw dates
        extra: ['-enc', 'UTF-8'] // force UTF-8 encoding
      };
      
      console.log("📄 Extracting text with poppler...");
      const result = await pdfPoppler.convert(tmpPdfPath, options);
      
      if (result && result.length > 0) {
        // Read the extracted text file
        const textFilePath = path.join(tmpDir, 'extracted-1.txt');
        const extractedText = await fs.readFile(textFilePath, 'utf8');
        
        console.log(`✅ Poppler extraction successful: ${extractedText.length} characters`);
        console.log(`📝 Sample: "${extractedText.substring(0, 200)}..."`);
        
        // Clean up temp files
        await fs.rm(tmpDir, { recursive: true, force: true });
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
                textCount: page.Texts?.length || 0,
                hasFills: !!(page.Fills && page.Fills.length > 0),
                fillCount: page.Fills?.length || 0
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
          
          console.log(`✅ pdf2json extraction successful: ${extractedText.length} characters`);
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

  // Method 3: Fallback to command line pdftotext if available
  try {
    console.log("🚀 Method 3: Trying command line pdftotext...");
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    // Create temp directory
    const tmpDir = path.join(os.tmpdir(), 'pdf-cmd-extraction');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPdfPath = path.join(tmpDir, `temp-${Date.now()}.pdf`);
    const tmpTextPath = path.join(tmpDir, `extracted-${Date.now()}.txt`);
    
    try {
      // Write PDF to temp file
      await fs.writeFile(tmpPdfPath, pdfBuffer);
      
      // Try pdftotext command with various encoding options
      const commands = [
        `pdftotext -enc UTF-8 -layout "${tmpPdfPath}" "${tmpTextPath}"`,
        `pdftotext -layout "${tmpPdfPath}" "${tmpTextPath}"`,
        `pdftotext "${tmpPdfPath}" "${tmpTextPath}"`
      ];
      
      for (const command of commands) {
        try {
          console.log(`� Trying command: ${command}`);
          await execAsync(command);
          
          // Read the extracted text
          const extractedText = await fs.readFile(tmpTextPath, 'utf8');
          
          if (extractedText.trim().length > 20) {
            console.log(`✅ Command line pdftotext successful: ${extractedText.length} characters`);
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
    
  } catch (cmdMethodError) {
    console.log(`❌ Command line method failed: ${cmdMethodError.message}`);
  }

  // Method 2: OCR using pdf2pic + tesseract (for image-based or encoded PDFs)
  try {
    console.log("🚀 Method 2: OCR extraction using pdf2pic...");
    
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    // Create temp directory
    const tmpDir = path.join(os.tmpdir(), 'pdf-ocr-extraction');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPdfPath = path.join(tmpDir, `temp-${Date.now()}.pdf`);
    
    try {
      // Write PDF to temp file
      await fs.writeFile(tmpPdfPath, pdfBuffer);
      console.log(`📁 Created temp PDF: ${tmpPdfPath}`);
      
      // Convert PDF to images
      const pdf2pic = await import('pdf2pic');
      const convertToPic = pdf2pic.default || pdf2pic;
      
      const options = {
        density: 300,           // Higher DPI for better OCR
        saveFilename: "page",
        savePath: tmpDir,
        format: "png",
        width: 2480,           // A4 at 300 DPI
        height: 3508
      };
      
      console.log("🖼️ Converting PDF to images...");
      const result = await convertToPic(tmpPdfPath, options);
      
      if (!result || !result.length) {
        throw new Error("No pages converted to images");
      }
      
      console.log(`📸 Converted ${result.length} pages to images`);
      
      // Try basic text extraction from images (if tesseract is available)
      let ocrText = "";
      
      try {
        // First try with tesseract if available
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        for (let i = 0; i < Math.min(result.length, 3); i++) { // Limit to first 3 pages for performance
          const imagePath = result[i].path;
          console.log(`🔍 OCR processing page ${i + 1}: ${imagePath}`);
          
          try {
            // Try tesseract if available
            const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l eng`);
            if (stdout && stdout.trim()) {
              ocrText += stdout.trim() + '\n\n';
              console.log(`✅ OCR extracted ${stdout.length} chars from page ${i + 1}`);
            }
          } catch (tesseractError) {
            console.log(`⚠️ Tesseract not available for page ${i + 1}: ${tesseractError.message}`);
            
            // Fallback: Basic image analysis (just return a helpful message)
            ocrText += `[Page ${i + 1}: Image-based content detected - OCR tools needed for text extraction]\n\n`;
          }
        }
        
        if (ocrText.trim().length > 50) {
          console.log(`✅ OCR extraction successful: ${ocrText.length} characters`);
          console.log(`📝 OCR sample: "${ocrText.substring(0, 200)}..."`);
          return ocrText.trim();
        }
        
      } catch (ocrError) {
        console.log(`❌ OCR processing failed: ${ocrError.message}`);
      }
      
    } finally {
      // Clean up temp files
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temp directory: ${tmpDir}`);
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
      }
    }
    
  } catch (ocrMethodError) {
    console.log(`❌ OCR method failed: ${ocrMethodError.message}`);
  }

  // Method 3: Advanced binary text extraction (fallback)
  try {
    console.log("🚀 Method 3: Advanced binary text extraction...");
    
    // Try different encodings for the PDF string
    const encodings = ['latin1', 'ascii', 'utf8'];
    let bestText = '';
    let bestScore = 0;
    
    for (const encoding of encodings) {
      try {
        const pdfString = pdfBuffer.toString(encoding);
        let extractedText = '';
        
        // Pattern 1: Text between parentheses (standard PDF text encoding)
        const textMatches = [];
        const simpleTextPattern = /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)/g;
        let match;
        while ((match = simpleTextPattern.exec(pdfString)) !== null) {
          let text = match[1];
          // Handle escaped characters
          text = text.replace(/\\(.)/g, (match, char) => {
            if (char === 'n') return '\n';
            if (char === 'r') return '\r';
            if (char === 't') return '\t';
            if (char === '\\') return '\\';
            if (char === '(') return '(';
            if (char === ')') return ')';
            return char;
          });
          
          // Clean and validate text
          text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
          if (text && text.length > 1 && /[a-zA-Z0-9]/.test(text)) {
            textMatches.push(text);
          }
        }
        
        // Pattern 2: Text between angle brackets (hex encoded)
        const hexTextPattern = /<([0-9A-Fa-f\s]+)>/g;
        while ((match = hexTextPattern.exec(pdfString)) !== null) {
          const hexString = match[1].replace(/\s/g, '');
          if (hexString.length % 2 === 0 && hexString.length > 0) {
            let text = '';
            for (let i = 0; i < hexString.length; i += 2) {
              const charCode = parseInt(hexString.substr(i, 2), 16);
              // Handle both ASCII and extended character ranges
              if ((charCode >= 32 && charCode <= 126) || (charCode >= 160 && charCode <= 255)) {
                text += String.fromCharCode(charCode);
              } else if (charCode === 9 || charCode === 10 || charCode === 13) {
                text += String.fromCharCode(charCode);
              }
            }
            text = text.trim();
            if (text.length > 1 && /[a-zA-Z0-9]/.test(text)) {
              textMatches.push(text);
            }
          }
        }
        
        // Pattern 3: Look for readable ASCII sequences
        const asciiPattern = /[A-Za-z][A-Za-z0-9\s.,!?@#$%^&*()_+=\-:;'"]{8,}/g;
        const asciiMatches = pdfString.match(asciiPattern) || [];
        
        // Pattern 4: Extract text after common PDF operators
        const textOperatorPattern = /(?:Tj|TJ|'|")\s*$[\s\S]*?^\s*(?:\(([^)]*)\)|<([0-9A-Fa-f]+)>)/gm;
        const operatorMatches = [];
        while ((match = textOperatorPattern.exec(pdfString)) !== null) {
          const text = match[1] || match[2];
          if (text && text.length > 1) {
            operatorMatches.push(text);
          }
        }
        
        // Combine all matches
        const allMatches = [...textMatches, ...asciiMatches, ...operatorMatches]
          .filter(text => text && text.trim().length > 2)
          .filter(text => /[a-zA-Z]/.test(text))
          .map(text => {
            // Clean up encoding artifacts
            return text
              .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          })
          .filter(text => text.length > 0);
        
        if (allMatches.length > 0) {
          extractedText = allMatches.join(' ').replace(/\s+/g, ' ').trim();
          
          // Score this extraction
          const hasWords = (extractedText.match(/\b[a-zA-Z]{2,}\b/g) || []).length;
          const hasCommonWords = (extractedText.match(/\b(the|and|or|of|to|in|for|with|on|at|by|from|about|experience|skills|education|work|job|company|position|role|responsibility|manage|develop|project|team|years|university|degree|certification|software|technology|programming|language|tool|framework|database|system|application|solution|client|customer|business|professional|technical|analysis|design|implementation|testing|deployment|maintenance|support|training|communication|leadership|collaboration|problem|solving|innovation|improvement|optimization|performance|quality|security|compliance|documentation|reporting|planning|coordination|supervision|budget|strategic|operational|tactical|creative|analytical|detail|oriented|motivated|dedicated|reliable|flexible|adaptable|organized|efficient|effective|proactive|results|driven|goal|oriented|self|starter|independent|team|player|interpersonal|verbal|written|presentation|negotiation|sales|marketing|finance|accounting|human|resources|legal|administrative|executive|management|director|manager|supervisor|coordinator|specialist|analyst|developer|engineer|architect|designer|consultant|advisor|representative|associate|assistant|intern|volunteer|contractor|freelance|remote|onsite|fulltime|parttime|temporary|permanent|entry|level|senior|junior|mid|level|experienced|expert|advanced|beginner|intermediate|basic|proficient|fluent|native|bilingual|multilingual|certified|licensed|accredited|qualified|eligible|authorized|approved|validated|verified|confirmed|endorsed|recommended|preferred|required|desired|optional|negotiable|competitive|excellent|outstanding|exceptional|superior|high|quality|top|notch|world|class|industry|leading|cutting|edge|state|art|innovative|pioneering|groundbreaking|revolutionary|transformative|disruptive|scalable|robust|reliable|secure|efficient|effective|user|friendly|intuitive|responsive|adaptive|flexible|customizable|configurable|modular|extensible|maintainable|sustainable|cost|effective|time|saving|productivity|enhancing|performance|boosting|revenue|generating|profit|maximizing|market|share|increasing|customer|satisfaction|improving|brand|awareness|building|competitive|advantage|creating|value|adding|roi|positive|measurable|quantifiable|significant|substantial|considerable|notable|remarkable|impressive|outstanding|exceptional|extraordinary|unprecedented|unparalleled|unmatched|unique|distinctive|innovative|creative|original|fresh|new|modern|contemporary|current|up|date|latest|recent|emerging|trending|popular|in|demand|sought|after|valuable|beneficial|useful|helpful|practical|applicable|relevant|appropriate|suitable|ideal|perfect|excellent|great|good|satisfactory|acceptable|adequate|sufficient|necessary|essential|critical|vital|important|significant|key|main|primary|principal|major|minor|secondary|additional|supplementary|complementary|supporting|contributing|related|relevant|applicable|pertinent|germane|material|substantial|considerable|extensive|comprehensive|thorough|detailed|specific|precise|accurate|exact|correct|right|proper|appropriate|suitable|fitting|relevant|applicable|pertinent|valid|legitimate|authorized|official|formal|legal|lawful|compliant|conforming|adhering|following|observing|respecting|honoring|upholding|maintaining|preserving|protecting|safeguarding|ensuring|guaranteeing|assuring|confirming|verifying|validating|authenticating|certifying|approving|endorsing|recommending|supporting|advocating|promoting|encouraging|facilitating|enabling|empowering|equipping|preparing|training|educating|developing|enhancing|improving|upgrading|advancing|progressing|evolving|growing|expanding|scaling|extending|broadening|diversifying|specializing|focusing|concentrating|targeting|aiming|directing|guiding|leading|managing|overseeing|supervising|coordinating|organizing|planning|strategizing|implementing|executing|delivering|achieving|accomplishing|completing|finishing|concluding|wrapping|summarizing|evaluating|assessing|analyzing|reviewing|examining|investigating|researching|studying|exploring|discovering|uncovering|identifying|recognizing|understanding|comprehending|grasping|realizing|appreciating|acknowledging|accepting|embracing|adopting|implementing|incorporating|integrating|combining|merging|blending|mixing|connecting|linking|joining|uniting|collaborating|cooperating|partnering|working|together|teamwork|communication|interaction|engagement|participation|involvement|contribution|input|feedback|response|reaction|comment|suggestion|recommendation|advice|guidance|direction|instruction|teaching|coaching|mentoring|supporting|helping|assisting|aiding|facilitating|enabling|empowering|encouraging|motivating|inspiring|influencing|persuading|convincing|negotiating|mediating|resolving|solving|addressing|handling|dealing|managing|coping|adapting|adjusting|modifying|changing|transforming|converting|transitioning|migrating|upgrading|updating|refreshing|renewing|revitalizing|rejuvenating|restoring|repairing|fixing|troubleshooting|debugging|testing|validating|verifying|confirming|ensuring|guaranteeing|securing|protecting|defending|safeguarding|maintaining|preserving|conserving|sustaining|continuing|persisting|persevering|enduring|lasting|remaining|staying|keeping|holding|retaining|maintaining|preserving|storing|saving|backing|archiving|documenting|recording|tracking|monitoring|observing|watching|supervising|overseeing|controlling|regulating|governing|administering|managing|directing|leading|guiding|steering|navigating|driving|pushing|pulling|moving|shifting|transferring|relocating|repositioning|reorienting|refocusing|redirecting|realigning|restructuring|reorganizing|reengineering|redesigning|rebuilding|reconstructing|recreating|regenerating|renewing|refreshing|revitalizing|rejuvenating|restoring|recovering|retrieving|reclaiming|regaining|reestablishing|reinstating|reintroducing|reactivating|restarting|resuming|continuing|proceeding|advancing|progressing|developing|growing|expanding|increasing|rising|climbing|ascending|elevating|lifting|raising|boosting|enhancing|improving|upgrading|optimizing|maximizing|minimizing|reducing|decreasing|lowering|cutting|trimming|streamlining|simplifying|clarifying|explaining|illustrating|demonstrating|showing|displaying|presenting|exhibiting|revealing|exposing|uncovering|discovering|finding|locating|identifying|recognizing|detecting|spotting|noticing|observing|seeing|viewing|looking|examining|inspecting|checking|reviewing|evaluating|assessing|analyzing|studying|researching|investigating|exploring|surveying|scanning|searching|seeking|hunting|pursuing|chasing|following|tracking|tracing|monitoring|watching|observing|supervising|overseeing|managing|controlling|directing|guiding|leading|heading|commanding|governing|ruling|regulating|administering|operating|running|conducting|performing|executing|carrying|delivering|providing|offering|supplying|furnishing|equipping|outfitting|preparing|setting|establishing|creating|building|constructing|developing|designing|planning|organizing|arranging|coordinating|scheduling|timing|synchronizing|aligning|matching|fitting|suiting|adapting|adjusting|modifying|customizing|tailoring|personalizing|individualizing|specializing|focusing|concentrating|targeting|aiming|directing|orienting|positioning|placing|locating|situating|establishing|setting|installing|mounting|attaching|connecting|linking|joining|combining|merging|integrating|incorporating|including|adding|inserting|introducing|implementing|deploying|launching|starting|beginning|initiating|commencing|opening|activating|enabling|turning|switching|operating|running|functioning|working|performing|executing|processing|handling|managing|dealing|addressing|tackling|approaching|attacking|confronting|facing|meeting|encountering|experiencing|undergoing|enduring|suffering|tolerating|accepting|embracing|welcoming|receiving|getting|obtaining|acquiring|gaining|earning|winning|achieving|accomplishing|reaching|attaining|securing|capturing|seizing|grasping|holding|keeping|maintaining|preserving|protecting|defending|guarding|shielding|covering|sheltering|housing|accommodating|containing|holding|storing|keeping|saving|reserving|retaining|maintaining|sustaining|supporting|backing|endorsing|approving|accepting|agreeing|consenting|permitting|allowing|enabling|facilitating|helping|assisting|aiding|supporting|encouraging|promoting|advocating|championing|defending|protecting|safeguarding|securing|ensuring|guaranteeing|promising|committing|dedicating|devoting|investing|contributing|participating|engaging|involving|including|incorporating|integrating|combining|merging|blending|mixing|joining|connecting|linking|associating|relating|corresponding|matching|fitting|suiting|appropriate|suitable|proper|correct|right|accurate|precise|exact|specific|particular|individual|personal|private|confidential|sensitive|classified|restricted|limited|exclusive|special|unique|distinctive|characteristic|typical|representative|standard|normal|regular|ordinary|common|usual|familiar|known|recognized|established|proven|tested|verified|validated|confirmed|certified|approved|authorized|licensed|qualified|eligible|capable|competent|skilled|experienced|knowledgeable|expert|professional|proficient|fluent|advanced|superior|excellent|outstanding|exceptional|remarkable|impressive|notable|significant|important|valuable|beneficial|useful|helpful|practical|effective|efficient|productive|successful|accomplished|achieved|completed|finished|done|ready|prepared|equipped|qualified|certified|trained|educated|developed|experienced|skilled|knowledgeable|informed|aware|conscious|mindful|attentive|focused|concentrated|dedicated|committed|devoted|loyal|faithful|reliable|dependable|trustworthy|honest|transparent|open|direct|straightforward|clear|explicit|specific|detailed|comprehensive|thorough|complete|full|entire|whole|total|overall|general|broad|wide|extensive|comprehensive|inclusive|complete|finished|done|ready|available|accessible|reachable|contactable|approachable|friendly|welcoming|inviting|engaging|interactive|responsive|adaptive|flexible|versatile|agile|quick|fast|rapid|speedy|efficient|effective|productive|successful|profitable|lucrative|rewarding|satisfying|fulfilling|meaningful|purposeful|significant|important|valuable|worthwhile|beneficial|advantageous|favorable|positive|optimistic|confident|assured|certain|sure|definite|clear|obvious|evident|apparent|visible|noticeable|observable|detectable|measurable|quantifiable|trackable|monitorable|manageable|controllable|predictable|reliable|consistent|stable|steady|constant|continuous|ongoing|persistent|enduring|lasting|permanent|sustainable|maintainable|renewable|reusable|recyclable|environmentally|friendly|green|clean|pure|natural|organic|healthy|safe|secure|protected|defended|guarded|shielded|covered|insured|guaranteed|warranted|certified|approved|authorized|licensed|registered|recognized|accredited|validated|verified|confirmed|authenticated|genuine|real|actual|true|factual|accurate|correct|right|proper|appropriate|suitable|fitting|relevant|applicable|pertinent|related|connected|linked|associated|correlated|corresponding|matching|compatible|consistent|coherent|logical|rational|reasonable|sensible|practical|realistic|feasible|viable|achievable|attainable|reachable|accessible|available|obtainable|acquirable|winnable|doable|possible|probable|likely|expected|anticipated|predicted|forecasted|projected|estimated|calculated|measured|assessed|evaluated|analyzed|reviewed|examined|investigated|researched|studied|explored|discovered|found|identified|recognized|detected|located|spotted|noticed|observed|seen|viewed|watched|monitored|tracked|followed|pursued|chased|hunted|sought|searched|looked|examined|inspected|checked|tested|tried|attempted|undertaken|engaged|involved|participated|contributed|helped|assisted|supported|aided|facilitated|enabled|empowered|encouraged|motivated|inspired|influenced|persuaded|convinced|negotiated|mediated|resolved|solved|addressed|handled|managed|dealt|coped|adapted|adjusted|modified|changed|transformed|converted|transitioned|migrated|upgraded|updated|improved|enhanced|optimized|maximized|increased|boosted|elevated|raised|lifted|promoted|advanced|progressed|developed|grew|expanded|extended|broadened|widened|lengthened|deepened|strengthened|reinforced|fortified|secured|protected|defended|guarded|preserved|maintained|sustained|supported|backed|endorsed|approved|recommended|suggested|proposed|offered|provided|supplied|delivered|given|granted|awarded|presented|shown|displayed|exhibited|demonstrated|illustrated|explained|described|outlined|detailed|specified|clarified|defined|identified|named|labeled|tagged|marked|indicated|pointed|highlighted|emphasized|stressed|underlined|noted|mentioned|stated|declared|announced|proclaimed|published|released|issued|distributed|shared|spread|communicated|transmitted|conveyed|delivered|sent|dispatched|forwarded|transferred|moved|shifted|relocated|transported|carried|brought|taken|led|guided|directed|steered|navigated|drove|operated|controlled|managed|administered|governed|ruled|regulated|supervised|oversaw|monitored|watched|observed|viewed|looked|examined|inspected|checked|reviewed|evaluated|assessed|analyzed|studied|researched|investigated|explored|surveyed|scanned|searched|hunted|sought|pursued|followed|tracked|traced|monitored|measured|quantified|calculated|computed|processed|handled|managed|dealt|addressed|tackled|approached|attacked|confronted|faced|met|encountered|experienced|underwent|endured|suffered|tolerated|accepted|embraced|welcomed|received|got|obtained|acquired|gained|earned|won|achieved|accomplished|reached|attained|secured|captured|seized|grasped|held|kept|maintained|preserved|protected|defended|guarded|shielded|covered|sheltered|housed|accommodated|contained|stored|saved|reserved|retained|sustained|supported|backed|endorsed|approved|accepted|agreed|consented|permitted|allowed|enabled|facilitated|helped|assisted|aided|supported|encouraged|promoted|advocated|championed|defended|protected|safeguarded|secured|ensured|guaranteed|promised|committed|dedicated|devoted|invested|contributed|participated|engaged|involved|included|incorporated|integrated|combined|merged|blended|mixed|joined|connected|linked|associated|related|corresponded|matched|fitted|suited|adapted|adjusted|modified|customized|tailored|personalized|individualized|specialized|focused|concentrated|targeted|aimed|directed|oriented|positioned|placed|located|situated|established|set|installed|mounted|attached|connected|linked|joined|combined|merged|integrated|incorporated|included|added|inserted|introduced|implemented|deployed|launched|started|began|initiated|commenced|opened|activated|enabled|turned|switched|operated|ran|functioned|worked|performed|executed|processed|handled|managed|dealt|addressed|tackled|approached|attacked|confronted|faced|met|encountered|experienced|underwent|endured|suffered|tolerated|accepted|embraced|welcomed|received|got|obtained|acquired|gained|earned|won|achieved|accomplished|reached|attained|secured|captured|seized|grasped|held|kept|maintained|preserved|protected|defended|guarded|shielded|covered|sheltered|housed|accommodated|contained|stored|saved|reserved|retained|sustained|supported|backed|endorsed|approved|accepted|agreed|consented|permitted|allowed|enabled|facilitated|helped|assisted|aided|supported|encouraged|promoted|advocated|championed|defended|protected|safeguarded|secured|ensured|guaranteed|promised|committed|dedicated|devoted|invested|contributed|participated|engaged|involved|included|incorporated|integrated|combined|merged|blended|mixed|joined|connected|linked|associated|related|corresponded|matched|fitted|suited|adapted|adjusted|modified|customized|tailored|personalized|individualized|specialized|focused|concentrated|targeted|aimed|directed|oriented|positioned|placed|located|situated|established|set|installed|mounted|attached|connected|linked|joined|combined|merged|integrated|incorporated|included|added|inserted|introduced|implemented|deployed|launched|started|began|initiated|commenced|opened|activated|enabled|turned|switched|operated|ran|functioned|worked|performed|executed|processed|handled|managed|dealt|addressed|tackled|approached|attacked|confronted|faced|met|encountered|experienced|underwent|endured|suffered|tolerated|accepted|embraced|welcomed|received|got|obtained|acquired|gained|earned|won|achieved|accomplished|reached|attained|secured|captured|seized|grasped|held|kept|maintained|preserved|protected|defended|guarded|shielded|covered|sheltered|housed|accommodated|contained|stored|saved|reserved|retained|sustained|supported|backed|endorsed|approved|accepted|agreed|consented|permitted|allowed|enabled|facilitated|helped|assisted|aided|supported|encouraged|promoted|advocated|championed|defended|protected|safeguarded|secured|ensured|guaranteed|promised|committed|dedicated|devoted|invested|contributed|participated|engaged|involved|included|incorporated|integrated|combined|merged|blended|mixed|joined|connected|linked|associated|related|corresponded|matched|fitted|suited)\b/gi) || []).length;
          const letterCount = (extractedText.match(/[a-zA-Z]/g) || []).length;
          const score = hasWords * 2 + hasCommonWords * 5 + Math.min(letterCount / 100, 50);
          
          console.log(`📊 ${encoding} encoding score: ${score} (words: ${hasWords}, common: ${hasCommonWords}, letters: ${letterCount})`);
          
          if (score > bestScore) {
            bestScore = score;
            bestText = extractedText;
          }
        }
      } catch (encodingError) {
        console.log(`⚠️ Failed to process ${encoding} encoding: ${encodingError.message}`);
      }
    }
    
    if (bestText && bestText.length > 50 && bestScore > 10) {
      console.log(`✅ Advanced binary extraction successful: ${bestText.length} characters (score: ${bestScore})`);
      console.log(`📝 Binary sample: "${bestText.substring(0, 200)}..."`);
      return bestText;
    } else {
      console.log(`⚠️ Advanced binary extraction found insufficient readable text (score: ${bestScore})`);
    }
    
  } catch (binaryError) {
    console.log(`❌ Advanced binary extraction failed: ${binaryError.message}`);
  }

  // If we get here, the PDF likely needs OCR tools installed
  const helpfulMessage = `This PDF appears to use custom font encoding or is image-based. 
  
To extract text properly, install OCR tools:
- Windows: Install Tesseract (choco install tesseract or download from GitHub)
- Or use online OCR services for complex PDFs with custom fonts.

The PDF was downloaded successfully (${pdfBuffer.length} bytes) but contains encoded text that requires specialized tools to decode.`;

  throw new Error(helpfulMessage);
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
    const rawCandidateId = body?.candidateId;
    // Accept either "<id>" or "user_<id>"; normalize to plain id and build user_<id> when needed
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
    
    let debugInfo = {
      originalUrl: resumeUrl,
      bucket: bucket,
      candidateId: candidateId,
      attempts: []
    };

    // First, let's list what's actually in the bucket for this user to debug
    if (candidateId) {
      try {
        console.log('🔍 Listing files in Supabase bucket for debugging...');
        
        // List files in the user's folder
        const { data: userFiles, error: userListError } = await supabase.storage
          .from(bucket)
          .list(`user_${candidateId}`, { recursive: true });
        
        if (!userListError && userFiles && userFiles.length > 0) {
          console.log(`📁 Files in user_${candidateId}:`, userFiles.map(f => `${f.name} (${f.metadata?.size || 'unknown size'})`));
          debugInfo.userFilesFound = userFiles.map(f => ({ name: f.name, size: f.metadata?.size }));
        } else {
          console.log(`📁 No files found in user_${candidateId} folder`);
        }
        
        // List files in the resumes folder structure
        const { data: resumeFiles1, error: resumeError1 } = await supabase.storage
          .from(bucket)
          .list(`resumes/user_${candidateId}`, { recursive: true });
        
        if (!resumeError1 && resumeFiles1 && resumeFiles1.length > 0) {
          console.log(`📄 Files in resumes/user_${candidateId}:`, resumeFiles1.map(f => `${f.name} (${f.metadata?.size || 'unknown size'})`));
          debugInfo.resumeFiles1Found = resumeFiles1.map(f => ({ name: f.name, size: f.metadata?.size }));
        }
        
        // Also try the broader resumes folder
        const { data: resumeFiles2, error: resumeError2 } = await supabase.storage
          .from(bucket)
          .list('resumes', { recursive: true });
        
        if (!resumeError2 && resumeFiles2 && resumeFiles2.length > 0) {
          const userResumeFiles = resumeFiles2.filter(f => f.name.includes(`user_${candidateId}`));
          if (userResumeFiles.length > 0) {
            console.log(`📄 User files in broader resumes folder:`, userResumeFiles.map(f => `${f.name} (${f.metadata?.size || 'unknown size'})`));
            debugInfo.resumeFiles2Found = userResumeFiles.map(f => ({ name: f.name, size: f.metadata?.size }));
          }
        }
      } catch (listErr) {
        console.log('❌ Could not list files:', listErr.message);
        debugInfo.listError = listErr.message;
      }
    }

    let objectPath;
    // Parse the resume URL to extract object path
    if (/^https?:\/\//i.test(resumeUrl)) {
      // Extract from public URL
      const urlParts = resumeUrl.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        const pathWithBucket = urlParts[1].split('?')[0];
        objectPath = pathWithBucket.startsWith(`${bucket}/`) 
          ? pathWithBucket.substring(`${bucket}/`.length)
          : pathWithBucket;
      }
    } else {
      // Treat as object path
      objectPath = resumeUrl.startsWith(`${bucket}/`) 
        ? resumeUrl.substring(`${bucket}/`.length)
        : resumeUrl;
    }

    console.log('Extracted object path:', objectPath);

    // Create comprehensive path variants based on actual file structure
  const fileName = objectPath ? objectPath.split('/').pop() : null;
  const userPrefix = candidateId ? `user_${candidateId}` : null;
    
    const pathVariants = [
      // Direct path as stored
      objectPath,
      // Remove leading slashes
      objectPath?.replace(/^\/+/, ''),
  // Common structures
  userPrefix && fileName ? `${userPrefix}/resumes/${fileName}` : null,
  // Observed public URL structure (resumes/<user_...>/<file>)
  userPrefix && fileName ? `resumes/${userPrefix}/${fileName}` : null,
  // Over-nested saved structure
  userPrefix && fileName ? `${userPrefix}/resumes/${userPrefix}/${fileName}` : null,
      fileName ? `resumes/${fileName}` : null,
      // If objectPath already includes user prefix
      objectPath?.replace(`${userPrefix}/`, ''),
      // Direct filename
      fileName
    ].filter(Boolean).filter((path, index, arr) => arr.indexOf(path) === index);

    console.log('Will try these paths:', pathVariants);

    let pdfBuffer;
    let successfulPath;
    let lastError;

    for (let i = 0; i < pathVariants.length; i++) {
      const tryPath = pathVariants[i];
      console.log(`Attempt ${i + 1}: "${tryPath}"`);
      
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(tryPath);
        
        debugInfo.attempts.push({
          path: tryPath,
          success: !error,
          error: error?.message || null
        });
        
        if (error) {
          console.log(`❌ Failed: ${error.message}`);
          lastError = error;
          continue;
        }
        
        if (data) {
          pdfBuffer = Buffer.from(await data.arrayBuffer());
          console.log(`✅ Success! Downloaded ${pdfBuffer.length} bytes`);
          successfulPath = tryPath;
          break;
        }
      } catch (err) {
        console.log(`❌ Exception: ${err.message}`);
        debugInfo.attempts.push({
          path: tryPath,
          success: false,
          error: err.message
        });
        lastError = err;
      }
    }

    if (!pdfBuffer) {
      console.log('❌ All download attempts failed');
      return NextResponse.json({
        error: 'Failed to download PDF from Supabase Storage',
        details: `File not found. Tried ${pathVariants.length} paths in bucket '${bucket}'`,
        debugInfo: debugInfo,
        suggestion: "The file may be in a different location. Check the exact path in Supabase Storage console."
      }, { status: 404 });
    }

    // Extract text from PDF
    let extractedText = "";
    let pdfParseSuccess = false;
    
    try {
      console.log('Parsing PDF...');
      console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);
      console.log(`PDF buffer type: ${typeof pdfBuffer}`);
      console.log(`Is Buffer: ${Buffer.isBuffer(pdfBuffer)}`);
      
      // Try our custom extraction function
      extractedText = await extractPdfText(pdfBuffer);
      pdfParseSuccess = !!extractedText && extractedText.trim().length > 0;
      console.log(`PDF extraction result: ${extractedText.length} characters extracted`);
      
      if (!extractedText.trim()) {
        console.log("No text extracted. PDF may be scanned or image-only.");
        debugInfo.pdfParseNote = "This appears to be a scanned/image-based PDF with no extractable text.";
      }
    } catch (pdfError) {
      console.error('PDF parsing failed:', pdfError.message);
      debugInfo.pdfParseError = pdfError.message || String(pdfError);
      
      // Despite extraction failure, try to continue with empty text
      extractedText = "";
    }

    // Call OpenAI for analysis using the extracted text (best-effort)
    let analysis = "";
    try {
      // If no extracted text, use profileHint so the model has some context
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
        ...debugInfo,
        successfulPath,
  fileSize: pdfBuffer?.length,
  bufferIsBuffer: Buffer.isBuffer(pdfBuffer),
  bufferType: typeof pdfBuffer,
        textExtracted: extractedText.length > 0
      }
    });
  } catch (e) {
    const msg = e?.message || "Unknown error";
    console.error("/api/analyze-resume error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}