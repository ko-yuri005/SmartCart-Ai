import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { SqliteProductRepository } from '../db/repositories/product.repository.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const productRepo = new SqliteProductRepository(db);
    const productCount = productRepo.count();

    const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);

    res.json({
      status: 'ok',
      service: 'mini-shopping-assistant-api',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        type: 'sqlite',
        productCount,
      },
      gemini: {
        configured: isGeminiConfigured,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
