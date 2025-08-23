import { Request, Response } from "express";
import {
  createUser,
  loginUser,
  logoutUser,
} from "../../src/controllers/user.controller";
import db from "../../src/configs/db";
import redisClient from "../../src/configs/redis";
import bcrypt from "bcrypt";
import * as jwtUtils from "../../src/utils/jwt";
import crypto from "crypto";

// Mock das dependências externas
jest.mock("../../src/configs/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../src/configs/redis", () => ({
  setex: jest.fn(),
  get: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("../../src/utils/jwt", () => ({
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// Mock do crypto para consistência nos testes
jest.mock("crypto", () => ({
  createHash: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  digest: jest.fn().mockReturnValue("mockedHash"),
}));

// Utilitários para criar objetos simulados
const mockRequest = (body: any = {}, headers: any = {}): Request =>
  ({
    body,
    headers,
  } as unknown as Request);

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Constantes de teste
const MOCK_USER_DATA = {
  username: "testuser",
  password: "123456",
};

const MOCK_USER = {
  id: 1,
  username: "testuser",
  password: "hashedPassword",
};

const MOCK_TOKEN = "fakeJwtToken";
const MOCK_TOKEN_HASH = "mockedHash";

describe("User Controller - Testes com Mocks", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Configurações padrão dos mocks
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword");
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwtUtils.generateToken as jest.Mock).mockReturnValue(MOCK_TOKEN);
    (jwtUtils.verifyToken as jest.Mock).mockImplementation(
      (token: string, ignoreExpiration = false) => {
        if (token === "tokenValido") {
          return {
            id: MOCK_USER.id,
            username: MOCK_USER.username,
            exp: Math.floor(Date.now() / 1000) + 3600, // Expira em 1 hora
          };
        }
        throw new Error("Token inválido");
      }
    );
  });

  describe("createUser", () => {
    it("deve criar usuário com sucesso quando dados são válidos", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({});

      // Act
      await createUser(req, res);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(MOCK_USER_DATA.password, 10);

      expect(db.query).toHaveBeenCalledWith(
        "INSERT INTO users (username, password) VALUES ($1, $2)",
        [MOCK_USER_DATA.username, "hashedPassword"]
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: "Usuário criado com sucesso." },
      });
    });

    it("deve retornar erro 400 quando username já existe", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      const duplicateError = {
        code: "23505",
        message: "Nome de usuário já cadastrado",
      };
      (db.query as jest.Mock).mockRejectedValue(duplicateError);

      // Act
      await createUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: duplicateError.message,
      });
    });

    it("deve retornar erro 500 quando ocorre erro inesperado", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockRejectedValue(new Error("Erro de banco"));

      // Act
      await createUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro ao criar usuário.",
      });
    });
  });

  describe("loginUser", () => {
    it("deve realizar login com sucesso quando credenciais são válidas", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({
        rows: [MOCK_USER],
      });

      // Act
      await loginUser(req, res);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE username = $1",
        [MOCK_USER_DATA.username]
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        MOCK_USER_DATA.password,
        MOCK_USER.password
      );

      expect(jwtUtils.generateToken).toHaveBeenCalledWith({
        id: MOCK_USER.id,
        username: MOCK_USER.username,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: "Login realizado com sucesso.",
          token: MOCK_TOKEN,
          user: { id: MOCK_USER.id, username: MOCK_USER.username },
        },
      });
    });

    it("deve falhar com 401 se o usuário não for encontrado no banco", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Credenciais inválidas.",
      });
    });

    it("deve retornar erro 401 quando senha é inválida", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({
        rows: [MOCK_USER],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      await loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Credenciais inválidas.",
      });
    });

    it("deve retornar erro 500 quando ocorre erro inesperado", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockRejectedValue(new Error("Erro de banco"));

      // Act
      await loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro ao realizar login.",
      });
    });
  });

  describe("logoutUser", () => {
    it("deve invalidar token com sucesso quando token é válido", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenValido" });
      const res = mockResponse();
      (redisClient.setex as jest.Mock).mockResolvedValue("OK");

      // Act
      await logoutUser(req, res);

      // Assert
      expect(crypto.createHash).toHaveBeenCalledWith("sha256");
      expect(crypto.createHash("sha256").update).toHaveBeenCalledWith(
        "tokenValido"
      );
      expect(
        crypto.createHash("sha256").update("tokenValido").digest
      ).toHaveBeenCalledWith("hex");

      expect(redisClient.setex).toHaveBeenCalledWith(
        `blacklist:jwt:${MOCK_TOKEN_HASH}`,
        expect.any(Number),
        "true"
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: "Logout realizado com sucesso. Token invalidado." },
      });
    });

    it("deve retornar erro 401 quando token não é fornecido", async () => {
      // Arrange
      const req = mockRequest({}, {});
      const res = mockResponse();

      // Act
      await logoutUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Token não fornecido",
      });
    });

    it("deve retornar erro 400 quando token é inválido", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenInvalido" });
      const res = mockResponse();

      // Mock para token que verifica mas não tem expiração
      (jwtUtils.verifyToken as jest.Mock).mockReturnValue({
        id: 1,
        username: "testuser",
        // sem propriedade 'exp'
      });

      // Act
      await logoutUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Token inválido",
      });
    });

    it("deve retornar erro 500 quando ocorre erro no Redis", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenValido" });
      const res = mockResponse();
      (redisClient.setex as jest.Mock).mockRejectedValue(
        new Error("Erro no Redis")
      );

      // Act
      await logoutUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro ao realizar logout.",
      });
    });

    it("ddeve aplicar TTL de 60s no Redis ao invalidar token expirado", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenExpirado" });
      const res = mockResponse();

      // Mock para token expirado
      (jwtUtils.verifyToken as jest.Mock).mockImplementation(
        (token: string, ignoreExpiration = false) => {
          if (token === "tokenExpirado") {
            return {
              id: MOCK_USER.id,
              username: MOCK_USER.username,
              exp: Math.floor(Date.now() / 1000) - 3600, // Expirou há 1 hora
            };
          }
          throw new Error("Token inválido");
        }
      );

      (redisClient.setex as jest.Mock).mockResolvedValue("OK");

      // Act
      await logoutUser(req, res);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `blacklist:jwt:${MOCK_TOKEN_HASH}`,
        60, // Deve usar 60 segundos para tokens expirados
        "true"
      );
    });
  });
});
