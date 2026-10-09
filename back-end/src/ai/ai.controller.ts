import type { Request, Response } from 'express';
import { z } from 'zod';

import * as conversationsService from '../conversations/conversations.service.js';
import { getPreset } from '../presets/presets.service.js';
import { claimFreeTrial } from '../users/users.service.js';
import * as aiService from './ai.service.js';

const ALLOWED_MODELS = ['deepseek-chat', 'deepseek-reasoner'] as const;

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1),
  model: z.enum(ALLOWED_MODELS),
  presetId: z.string().uuid().optional(),
  templateHtml: z.string().optional(),
});

export async function chat(req: Request, res: Response): Promise<void> {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.flattenError(parsed.error) });
    return;
  }

  const { conversationId, message, model, presetId, templateHtml: requestTemplateHtml } = parsed.data;
  const { id: userId, email, role } = req.user!;

  // Non-admins get one free prompt per mailbox (see claimFreeTrial)
  if (role !== 'admin' && !(await claimFreeTrial(userId, email))) {
    res.status(402).json({ error: 'trial_exhausted' });
    return;
  }

  // Get or create the conversation
  let conversation: Awaited<ReturnType<typeof conversationsService.getConversation>>;

  if (conversationId) {
    conversation = await conversationsService.getConversation(conversationId, userId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
  } else {
    const title = message.slice(0, 60).trim();
    const newConv = await conversationsService.createConversation(userId, title, presetId);
    conversation = { ...newConv, messages: [] };
    // If the user opened an existing template for editing, seed the new conversation with it
    if (requestTemplateHtml) {
      await conversationsService.updateConversation(newConv.id, userId, {
        template_html: requestTemplateHtml,
      });
      conversation = { ...conversation, template_html: requestTemplateHtml };
    }
  }

  // Persist the new user message
  await conversationsService.addMessage(conversation.id, 'user', message);

  // Build the full message history for the AI
  const history = [
    ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  // Resolve preset (from conversation or from the request for a new conversation)
  const resolvedPresetId = conversation.preset_id ?? presetId;
  const preset = resolvedPresetId ? await getPreset(resolvedPresetId, userId) : null;

  // Call the AI
  let aiResponse: Awaited<ReturnType<typeof aiService.chat>>;
  try {
    aiResponse = await aiService.chat(history, model, preset, conversation.template_html ?? undefined);
  } catch (err) {
    console.error('[AI] DeepSeek call failed for model "%s":', model, err);
    res.status(502).json({ error: 'AI service error' });
    return;
  }

  // Persist the AI response
  if (aiResponse.message) {
    await conversationsService.addMessage(conversation.id, 'assistant', aiResponse.message);
  }

  // Keep the conversation's template_html in sync with the latest generated template
  if (aiResponse.templateHtml) {
    await conversationsService.updateConversation(conversation.id, userId, {
      template_html: aiResponse.templateHtml,
    });
  }

  res.json({ conversationId: conversation.id, ...aiResponse });
}
