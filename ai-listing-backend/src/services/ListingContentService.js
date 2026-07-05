/**
 * ListingContentService — builds the AI prompt for a given listing type +
 * form fields, calls GrokService, and parses the model's JSON reply into
 * { title, description }.
 */
const groqService = require('./GroqService');
const { getTypeById } = require('../data/listingTypes');

const TONE_DESCRIPTIONS = {
  professional: 'professional and trustworthy',
  friendly: 'warm and friendly',
  luxury: 'upscale and luxury-oriented',
  urgent: 'urgent, creating a sense that this offer will not last long'
};

class ListingContentService {
  buildMessages(type, fields) {
    const { subject, details, city, referenceId, tone, outputLanguage } = fields;
    const langName = outputLanguage === 'tr' ? 'Turkish' : 'English';
    const toneDesc = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.professional;

    let constraintText = '';
    if (type.constraints) {
      const c = type.constraints;
      const parts = [];
      if (c.maxTitleLen) parts.push(`the "title" must be at most ${c.maxTitleLen} characters`);
      if (c.maxDescLen) parts.push(`the "description" must be at most ${c.maxDescLen} characters`);
      if (parts.length) constraintText = ` Hard constraints: ${parts.join('; ')}.`;
    }

    const systemPrompt =
      `You are an expert copywriter specializing in "${type.label.en}" listings/content. ` +
      `${type.promptGuidance} ` +
      `Write in ${langName}. Use a ${toneDesc} tone. ` +
      `Only use facts the user gives you — never invent specifics (price, size, brand, location) that were not provided.` +
      constraintText +
      ` Respond with ONLY a valid JSON object of the exact shape {"title": "...", "description": "..."} and nothing else — no markdown, no code fences, no commentary.`;

    const userLines = [`Subject: ${subject}`, `Key details: ${details}`];
    if (city) userLines.push(`Location/City: ${city}`);
    if (referenceId) userLines.push(`Reference/Agency ID (include verbatim in the description if it reads naturally): ${referenceId}`);

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userLines.join('\n') }
    ];
  }

  parseResponse(raw) {
    let text = String(raw).trim();

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) text = fenceMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (!braceMatch) throw new Error('AI response was not valid JSON');
      parsed = JSON.parse(braceMatch[0]);
    }

    if (!parsed.title || !parsed.description) {
      throw new Error('AI response is missing title or description');
    }

    return { title: String(parsed.title).trim(), description: String(parsed.description).trim() };
  }

  async generate(typeId, fields) {
    const type = getTypeById(typeId);
    if (!type) {
      throw new Error(`Unknown listing type: ${typeId}`);
    }

    const messages = this.buildMessages(type, fields);
    const raw = await groqService.chatCompletion(messages, { temperature: 0.7 });
    return this.parseResponse(raw);
  }
}

module.exports = new ListingContentService();
