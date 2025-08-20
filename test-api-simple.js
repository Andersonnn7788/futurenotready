// Simple test to debug the PDF extraction issue
const http = require('http');

async function testAPI() {
  console.log('Testing analyze-resume API...');
  
  const postData = JSON.stringify({
    resumeUrl: "talentmatch/test.pdf",
    role: "Software Engineer"
  });
  
  const options = {
    hostname: 'localhost',
    port: 3004,
    path: '/api/analyze-resume',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', res.headers);
      
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log('Response body length:', body.length);
        console.log('Response body preview:', body.substring(0, 1000));
        
        try {
          const json = JSON.parse(body);
          console.log('\nParsed JSON:');
          console.log('- Error:', json.error);
          console.log('- PDF Parse Success:', json.pdfParseSuccess);
          console.log('- Text Length:', json.fullTextLength);
          console.log('- Debug Info:', json.debugInfo);
        } catch (e) {
          console.log('Could not parse as JSON:', e.message);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

testAPI();
