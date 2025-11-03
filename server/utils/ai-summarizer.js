const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const CHUNK_SIZE = 30000; // ~7500 tokens (4 chars ≈ 1 token)
const OVERLAP_SIZE = 500; // Characters overlapped between chunks
const MODEL_NAME = 'gemini-1.5-pro'; // Using Gemini 1.5 Pro

/**
 * Initialize Gemini AI client
 * @param {string} apiKey - Google Gemini API key
 * @returns {GoogleGenerativeAI} Initialized AI client
 * @throws {Error} If API key is not provided
 */
function initializeAI(apiKey) {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    console.log('✅ [AI-SUMMARIZER] Gemini AI initialized successfully');
    return ai;
  } catch (error) {
    throw new Error(`Failed to initialize Gemini AI: ${error.message}`);
  }
}

/**
 * Make API call to Gemini with retry logic
 * @private
 */
async function makeApiCall(prompt, apiKey, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const ai = initializeAI(apiKey);
      const modelClient = ai.getGenerativeModel({ model: MODEL_NAME });
      const response = await modelClient.generateContent(prompt);
      
      if (!response.response.text()) {
        throw new Error('Empty response from Gemini API');
      }

      return response.response.text();
    } catch (error) {
      console.error(`❌ [AI-SUMMARIZER] API call attempt ${i + 1} failed:`, error.message);

      // Check for specific errors
      if (error.message.includes('API_KEY_INVALID') || error.message.includes('401')) {
        throw new Error('Invalid Gemini API key. Please check your configuration.');
      }

      if (error.message.includes('RATE_LIMIT') || error.message.includes('429')) {
        if (i < retries - 1) {
          const waitTime = 2000 * (i + 1); // Exponential backoff
          console.log(`⏳ [AI-SUMMARIZER] Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      if (i === retries - 1) {
        throw error;
      }

      // Wait before retry
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

/**
 * Split text into chunks with overlap
 * @private
 */
function splitIntoChunks(text) {
  const chunks = [];
  
  for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, text.length);
    chunks.push(text.substring(i, end));
  }

  console.log(`📊 [AI-SUMMARIZER] Text split into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Summarize text using Gemini API
 * Handles both small and large documents
 * 
 * @param {string} documentText - Text to summarize
 * @param {string} apiKey - Gemini API key
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<string>} Summarized text
 * @throws {Error} If summarization fails
 */
async function summarizeText(documentText, apiKey, onProgress = null) {
  try {
    if (!documentText || typeof documentText !== 'string') {
      throw new Error('Document text must be a non-empty string');
    }

    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    console.log(`🧠 [AI-SUMMARIZER] Starting summarization:`, {
      textLength: documentText.length,
      modelName: MODEL_NAME,
    });

    // For small documents, summarize directly
    if (documentText.length <= CHUNK_SIZE) {
      console.log(`📄 [AI-SUMMARIZER] Document is small, summarizing directly...`);
      onProgress?.('Generating summary...');

      const prompt = `You are an expert in document analysis and summarization.
Provide a clear, concise, and accurate summary of the following document.
Focus on key points, main arguments, and important conclusions.

---
DOCUMENT CONTENT:
${documentText}`;

      const summary = await makeApiCall(prompt, apiKey);
      console.log(`✅ [AI-SUMMARIZER] Summarization complete`);
      return summary;
    }

    // For large documents, split into chunks
    console.log(`📄 [AI-SUMMARIZER] Document is large, splitting into chunks...`);
    onProgress?.('Splitting document into chunks...');

    const chunks = splitIntoChunks(documentText);

    // Summarize each chunk in parallel
    console.log(`🔄 [AI-SUMMARIZER] Summarizing ${chunks.length} chunks in parallel...`);
    onProgress?.(`Processing ${chunks.length} chunks...`);

    const chunkSummaries = await Promise.all(
      chunks.map(async (chunk, index) => {
        onProgress?.(`Processing chunk ${index + 1} of ${chunks.length}...`);

        const prompt = `This is one section of a larger document. Please summarize ONLY this section clearly and concisely.

---
SECTION CONTENT:
${chunk}`;

        try {
          const summary = await makeApiCall(prompt, apiKey);
          console.log(`✅ [AI-SUMMARIZER] Chunk ${index + 1} summarized successfully`);
          return summary;
        } catch (error) {
          console.error(`❌ [AI-SUMMARIZER] Failed to summarize chunk ${index + 1}:`, error.message);
          return `[Error summarizing section ${index + 1}]`;
        }
      })
    );

    // Combine summaries
    console.log(`🔗 [AI-SUMMARIZER] Combining chunk summaries...`);
    onProgress?.('Combining summaries...');

    const combinedSummaries = chunkSummaries
      .filter((s) => !s.startsWith('[Error'))
      .join('\n\n---\n\n');

    if (!combinedSummaries) {
      throw new Error('Failed to summarize any part of the document.');
    }

    // Create final combined summary
    console.log(`📝 [AI-SUMMARIZER] Creating final summary...`);
    onProgress?.('Creating final summary...');

    const finalPrompt = `The following are summaries of consecutive sections of a large document.
Synthesize them into one cohesive, structured, and comprehensive summary.

---
SECTION SUMMARIES:
${combinedSummaries}`;

    const finalSummary = await makeApiCall(finalPrompt, apiKey);

    console.log(`✅ [AI-SUMMARIZER] Final summarization complete`);
    onProgress?.('Summary complete!');

    return finalSummary;
  } catch (error) {
    console.error(`❌ [AI-SUMMARIZER] Summarization error:`, error.message);
    throw error;
  }
}

module.exports = {
  summarizeText,
  initializeAI,
};

