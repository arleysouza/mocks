import jwt, { SignOptions } from "jsonwebtoken";
import type { UserPayload } from "../types/express";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "1h") as SignOptions["expiresIn"];

if (!JWT_SECRET) {
  throw new Error("A variável de ambiente JWT_SECRET não está configurada.");
}

// Gera um JWT assinado
export function generateToken(payload: UserPayload): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, options);
}

// Verifica e retorna o payload do JWT
export function verifyToken(
  token: string,
  ignoreExpiration = false
): UserPayload {
  return jwt.verify(token, JWT_SECRET, { ignoreExpiration }) as UserPayload;
}
