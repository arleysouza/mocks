import { Request, Response, NextFunction } from "express";

// Niddleware global de tratamento de erros
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Erro capturado pelo middleware:", err);

  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
    // Em ambiente de desenvolvimento, incluímos detalhes do erro
    ...(process.env.NODE_ENV !== "production" && { details: err.message }),
  });
}
