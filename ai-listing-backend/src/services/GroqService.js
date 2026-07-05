/**
 * GroqService — thin wrapper around Groq's OpenAI-compatible chat completions
 * endpoint (https://groq.com — fast LPU inference, not to be confused with
 * xAI's "Grok" model).
 *
 * Supports a pool of API keys (config.groq.apiKeys, up to 20) so that a
 * rate-limited or rejected key never surfaces as a user-facing error: on
 * 429/401/403/network failure we silently retry the same request with the
 * next key in the pool. `currentIndex` is sticky — once a key succeeds we
 * keep starting from it on the next call instead of round-robining blindly.
 */
const fetch = require('node-fetch');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

let currentIndex = 0;

class GroqService {
  /**
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options - { temperature }
   * @returns {Promise<string>} raw text content of the model's reply
   */
  async chatCompletion(messages, options = {}) {
    const keys = config.groq.apiKeys;
    if (!keys.length) {
      throw new Error('GROQ_API_KEYS is not configured');
    }

    const { temperature = 0.7 } = options;
    let lastError = null;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const index = (currentIndex + attempt) % keys.length;
      const key = keys[index];

      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: config.groq.model,
            messages,
            temperature
          }),
          timeout: 30000
        });

        if (response.status === 429 || response.status === 401 || response.status === 403) {
          const errText = await response.text().catch(() => '');
          console.warn(`[GroqService] key #${index} rejected with ${response.status}, trying next key. ${errText.slice(0, 200)}`);
          lastError = new Error(`Groq API key #${index} rejected with ${response.status}`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Groq API error ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data = await response.json();
        const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) {
          throw new Error('Groq API returned an empty response');
        }

        currentIndex = index; // sticky: this key is currently working, keep using it first
        return content;
      } catch (error) {
        console.warn(`[GroqService] key #${index} request failed, trying next key: ${error.message}`);
        lastError = error;
      }
    }

    throw lastError || new Error('All Groq API keys failed');
  }
}

module.exports = new GroqService();
