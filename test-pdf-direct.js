// Direct test of PDF extraction with the actual files
const fs = require('fs');
const path = require('path');

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

  // Method 2: Try pdf2json
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
                for (const textObj of page.Texts) {
                  if (textObj.R && textObj.R.length > 0) {
                    for (const run of textObj.R) {
                      if (run.T) {
                        let decodedText = '';
                        try {
                          decodedText = decodeURIComponent(run.T);
                        } catch (decodeError) {
                          decodedText = run.T;
                        }
                        
                        decodedText = decodedText
                          .replace(/%20/g, ' ')
                          .replace(/%2C/g, ',')
                          .replace(/\s+/g, ' ')
                          .trim();
                        
                        if (decodedText.length > 0) {
                          extractedText += decodedText + ' ';
                        }
                      }
                    }
                  }
                }
                extractedText += '\n\n';
              }
            }
          }
          
          extractedText = extractedText.trim();
          
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
      }, 30000);
    });
    
  } catch (pdf2jsonError) {
    console.log(`❌ pdf2json failed: ${pdf2jsonError.message}`);
  }

  throw new Error('All PDF extraction methods failed');
}

async function testPdfExtraction() {
  try {
    // Test with one of the available PDF files
    const pdfPath = '.tmp/pdf-edc203c48d390c8f.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Test PDF file not found:', pdfPath);
      return;
    }
    
    console.log('📄 Testing PDF extraction with:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    const extractedText = await extractPdfText(pdfBuffer);
    
    console.log('\n🎉 SUCCESS! PDF text extracted:');
    console.log('='.repeat(50));
    console.log(extractedText.substring(0, 1000));
    console.log('='.repeat(50));
    console.log(`Total characters: ${extractedText.length}`);
    
  } catch (error) {
    console.error('❌ PDF extraction failed:', error.message);
  }
}

testPdfExtraction();
