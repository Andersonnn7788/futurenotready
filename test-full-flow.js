// Test the full analyze-resume flow with a real PDF file
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function testFullFlow() {
  // Setup Supabase client
  const supabase = createClient(
    'https://efxwbbjaemgkeckkpwuv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeHdiYmphZW1na2Vja2twd3V2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYwMzI0MiwiZXhwIjoyMDcxMTc5MjQyfQ.t4LsuWFZll0k6yh-D35sSlT64f_Av_873-N-IGQGn4k'
  );

  try {
    // Read the test PDF
    const pdfPath = '.tmp/pdf-edc203c48d390c8f.pdf';
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    console.log('📤 Uploading PDF to Supabase...');
    
    // Upload to Supabase
    const fileName = `test-resume-${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from('talentmatch')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf'
      });
    
    if (error) {
      console.error('❌ Upload failed:', error);
      return;
    }
    
    console.log('✅ PDF uploaded:', data.path);
    
    // Now test the analyze-resume API
    const testUrl = `http://localhost:3004/api/analyze-resume`;
    const resumeUrl = `talentmatch/${data.path}`;
    
    console.log('🔍 Testing analyze-resume API...');
    console.log('Resume URL:', resumeUrl);
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resumeUrl: resumeUrl,
        role: 'Software Engineer Intern',
        candidateId: 'test-candidate'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API call failed:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('\n🎉 SUCCESS! API Response:');
    console.log('='.repeat(50));
    console.log('PDF Parse Success:', result.pdfParseSuccess);
    console.log('Text Length:', result.fullTextLength);
    console.log('Extracted Text Preview:');
    console.log(result.extractedText);
    console.log('\nAnalysis:');
    console.log(result.analysis);
    console.log('='.repeat(50));
    
    // Clean up - delete the test file
    console.log('🧹 Cleaning up test file...');
    await supabase.storage.from('talentmatch').remove([data.path]);
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFullFlow();
