// Quick test to upload a PDF and test extraction
const fs = require('fs');

async function uploadAndTest() {
  console.log('=== PDF UPLOAD AND EXTRACTION TEST ===');
  
  // Check if we have a valid PDF file
  const testPdfPath = '.tmp/pdf-edc203c48d390c8f.pdf';
  
  if (!fs.existsSync(testPdfPath)) {
    console.log('❌ No test PDF found. Please ensure a PDF exists at:', testPdfPath);
    return;
  }
  
  console.log('📄 Found test PDF file:', testPdfPath);
  const stats = fs.statSync(testPdfPath);
  console.log('📊 File size:', stats.size, 'bytes');
  
  // Read the PDF and check header
  const pdfBuffer = fs.readFileSync(testPdfPath);
  const header = pdfBuffer.slice(0, 8).toString('ascii');
  console.log('📋 PDF header:', header);
  
  if (!header.startsWith('%PDF-')) {
    console.log('❌ Invalid PDF file - header does not start with %PDF-');
    return;
  }
  
  console.log('✅ Valid PDF file confirmed');
  console.log('\n📝 WHAT TO DO NEXT:');
  console.log('1. Upload this PDF through your application UI');
  console.log('2. Get the Supabase storage URL from the upload');
  console.log('3. Test the analyze-resume API with that real URL');
  console.log('4. Check browser console for detailed extraction logs');
  
  console.log('\n🔧 EXAMPLE API TEST:');
  console.log('POST http://localhost:3004/api/analyze-resume');
  console.log('Body: {');
  console.log('  "resumeUrl": "talentmatch/resumes/actual-uploaded-file.pdf",');
  console.log('  "role": "Software Engineer",');
  console.log('  "candidateId": "test-candidate"');
  console.log('}');
  
  console.log('\n⚠️  DO NOT TEST WITH:');
  console.log('- resumeUrl: "test" (not a real file)');
  console.log('- Local file paths (must be Supabase URLs)');
  console.log('- Non-existent files');
}

uploadAndTest();
