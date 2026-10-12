import { Router, Request, Response } from 'express';
import { ShoppingAssistantService } from '../services/shopping-assistant.service.js';
import { ISessionRepository } from '../db/repositories/session.repository.js';

export function createChatRouter(
  assistantService: ShoppingAssistantService,
  sessionRepo: ISessionRepository
): Router {
  const router = Router();

  /**
   * POST /api/chat
   * Core conversational assistant endpoint
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          error: 'Invalid request: Request body must be a JSON object',
        });
        return;
      }

      const { sessionId, message } = req.body;

      if (typeof message !== 'string') {
        res.status(400).json({
          error: 'Invalid request: "message" string is required',
        });
        return;
      }

      // Guard against denial-of-service / gigantic payloads
      if (message.length > 10000) {
        res.status(400).json({
          error: 'Invalid request: "message" exceeds maximum length of 10,000 characters',
        });
        return;
      }

      const cleanSessionId =
        typeof sessionId === 'string' && sessionId.trim().length > 0
          ? sessionId.trim().slice(0, 100)
          : undefined;

      const result = await assistantService.handleUserMessage(cleanSessionId, message);
      res.json(result);
    } catch (error) {
      console.error('[ChatAPI] Error processing message:', error);
      res.status(500).json({
        error: 'An internal error occurred while processing your request. Please try again.',
      });
    }
  });

  /**
   * GET /api/chat/history/:sessionId
   * Retrieves conversation transcript for session restoration
   */
  router.get('/chat/history/:sessionId', (req: Request, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const messages = sessionRepo.getMessages(sessionId, 50);
      res.json({
        sessionId,
        messages,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve chat history' });
    }
  });

  /**
   * POST /api/chat/reset
   * Clears context and history for a session
   */
  router.post('/chat/reset', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      if (sessionId) {
        sessionRepo.clearSession(sessionId);
        assistantService.clearSessionState(sessionId);
      }
      res.json({ success: true, message: 'Session reset successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset session' });
    }
  });

  return router;
}
