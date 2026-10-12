import { Router, Request, Response } from 'express';
import {
  VisualSearchService,
  VisualSearchValidationError,
} from '../services/visual-search.service.js';

export function createVisualSearchRouter(
  visualSearchService: VisualSearchService
): Router {
  const router = Router();

  /**
   * POST /api/visual-search
   * Analyzes an uploaded product image (or user-corrected clues) and searches the catalogue.
   * Never logs raw base64 image data.
   */
  router.post('/visual-search', async (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          error: 'Invalid request: Body must be a JSON object',
          code: 'INVALID_BODY',
        });
        return;
      }

      const {
        sessionId,
        imageData,
        mimeType,
        fileName,
        userHint,
        correction,
      } = req.body;

      const result = await visualSearchService.searchByImage({
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        imageData: typeof imageData === 'string' ? imageData : undefined,
        mimeType: typeof mimeType === 'string' ? mimeType : undefined,
        fileName: typeof fileName === 'string' ? fileName : undefined,
        userHint: typeof userHint === 'string' ? userHint : undefined,
        correction:
          correction && typeof correction === 'object' ? correction : undefined,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof VisualSearchValidationError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }
      console.error('[VisualSearchAPI] Error processing visual search');
      res.status(500).json({
        error: 'An error occurred while analyzing the product image.',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  return router;
}
