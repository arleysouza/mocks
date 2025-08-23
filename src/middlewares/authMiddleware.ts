import e, { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt"; // agora usa jsonwebtoken
import redisClient from "../configs/redis";
import crypto from "crypto";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Token não fornecido",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    // Gera hash do token para comparar com a blacklist
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Verifica se token está na blacklist do Redis
    const isBlacklisted = await redisClient.get(`blacklist:jwt:${tokenHash}`);
    
     if (isBlacklisted) {
      res.status(401).json({
        success: false,
        error: "Token expirado ou inválido",
      });
      return;
    }

    // Verifica e decodifica o token
    const payload = verifyToken(token);

    req.user = payload; // tipado via types/express/index.d.ts
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: "Token inválido ou expirado",
    });
  }
}
