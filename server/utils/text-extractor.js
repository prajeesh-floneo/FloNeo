const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from various file formats
 * Supports: PDF, DOCX, TXT
 * 
 * @param {string} filePath - Full path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 * @throws {Error} If file type is not supported or extraction fails
 */
async function extractTextFromFile(filePath, mimeType) {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`📄 [TEXT-EXTRACTOR] Extracting text from file:`, {
      filePath,
      mimeType,
      fileSize: fs.statSync(filePath).size,
    });

    // Read file buffer
    const buffer = fs.readFileSync(filePath);

    // Extract based on MIME type
    if (mimeType === 'application/pdf') {
      return await extractFromPDF(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return await extractFromDOCX(buffer);
    } else if (mimeType === 'text/plain') {
      return extractFromTXT(buffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error(`❌ [TEXT-EXTRACTOR] Error extracting text:`, error.message);
    throw error;
  }
}

/**
 * Extract text from PDF file
 * @private
 */
async function extractFromPDF(buffer) {
  try {
    console.log(`📄 [TEXT-EXTRACTOR] Extracting from PDF...`);
    const data = await pdfParse(buffer);
    const text = data.text || '';
    
    console.log(`✅ [TEXT-EXTRACTOR] PDF extraction complete:`, {
      pages: data.numpages,
      textLength: text.length,
    });

    return text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 * @private
 */
async function extractFromDOCX(buffer) {
  try {
    console.log(`📄 [TEXT-EXTRACTOR] Extracting from DOCX...`);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';

    console.log(`✅ [TEXT-EXTRACTOR] DOCX extraction complete:`, {
      textLength: text.length,
      warnings: result.messages?.length || 0,
    });

    return text;
  } catch (error) {
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from TXT file
 * @private
 */
function extractFromTXT(buffer) {
  try {
    console.log(`📄 [TEXT-EXTRACTOR] Extracting from TXT...`);
    const text = buffer.toString('utf-8');

    console.log(`✅ [TEXT-EXTRACTOR] TXT extraction complete:`, {
      textLength: text.length,
    });

    return text;
  } catch (error) {
    throw new Error(`TXT extraction failed: ${error.message}`);
  }
}

/**
 * Check if a file type is supported for text extraction
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} True if supported
 */
function isSupportedFileType(mimeType) {
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ];
  return supportedTypes.includes(mimeType);
}

module.exports = {
  extractTextFromFile,
  isSupportedFileType,
};

