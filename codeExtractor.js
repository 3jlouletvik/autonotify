function extractVerificationCode(message) {
  try {
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';

    let emailText = '';

    function extractTextFromPart(part) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString();
      }
      if (part.mimeType === 'text/html' && part.body.data && !emailText) {
        const html = Buffer.from(part.body.data, 'base64').toString();
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      }
      return '';
    }

    if (message.payload.parts) {
      for (const part of message.payload.parts) {
        emailText += extractTextFromPart(part);
        if (part.parts) {
          for (const subPart of part.parts) {
            emailText += extractTextFromPart(subPart);
          }
        }
      }
    } else if (message.payload.body.data) {
      emailText = Buffer.from(message.payload.body.data, 'base64').toString();
    }

    const codePatterns = [
      /\b(\d{4,8})\b/g,
      /code[:\s]+([A-Z0-9]{4,8})/gi,
      /verification[:\s]+([A-Z0-9]{4,8})/gi,
      /confirm[:\s]+([A-Z0-9]{4,8})/gi,
      /подтверждения[:\s]+(\d{4,8})/gi,
      /код[:\s]+(\d{4,8})/gi,
      /OTP[:\s]+([A-Z0-9]{4,8})/gi,
      /pin[:\s]+(\d{4,8})/gi,
      /token[:\s]+([A-Z0-9]{4,8})/gi
    ];

    const codes = new Set();

    for (const pattern of codePatterns) {
      const matches = emailText.matchAll(pattern);
      for (const match of matches) {
        const code = match[1];
        const uniqueChars = new Set(code.split('')).size;
        if (uniqueChars > 1) {
          codes.add(code);
        }
      }
    }

    const filteredCodes = Array.from(codes).filter(code => {
      const uniqueChars = new Set(code.split('')).size;
      return uniqueChars > 1;
    });

    return {
      codes: filteredCodes,
      subject,
      from,
      snippet: message.snippet
    };
  } catch (error) {
    console.error('❌ Ошибка извлечения кода:', error.message);
    return {
      codes: [],
      subject: '',
      from: '',
      snippet: ''
    };
  }
}

module.exports = { extractVerificationCode };
