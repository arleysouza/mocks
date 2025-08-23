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

// Mock das dependências externas - substitui as implementações reais por funções simuladas
jest.mock("../../src/configs/db", () => ({
  query: jest.fn(), // Mock da função query do banco de dados
}));

jest.mock("../../src/configs/redis", () => ({
  setex: jest.fn(), // Mock da função setex do Redis
  get: jest.fn(),    // Mock da função get do Redis
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),    // Mock da função hash do bcrypt
  compare: jest.fn(), // Mock da função compare do bcrypt
}));

jest.mock("../../src/utils/jwt", () => ({
  generateToken: jest.fn(), // Mock da função generateToken
  verifyToken: jest.fn(),   // Mock da função verifyToken
}));

// Mock do crypto para consistência nos testes - garante comportamento previsível
jest.mock("crypto", () => ({
  createHash: jest.fn().mockReturnThis(), // Mock que retorna o próprio objeto para encadeamento
  update: jest.fn().mockReturnThis(),     // Mock que retorna o próprio objeto para encadeamento  
  digest: jest.fn().mockReturnValue("mockedHash"), // Mock que sempre retorna hash fixo
}));

// Utilitários para criar objetos simulados de requisição e resposta
const mockRequest = (body: any = {}, headers: any = {}): Request =>
  ({
    body,    // Corpo da requisição simulada
    headers, // Cabeçalhos da requisição simulada
  } as unknown as Request); // Type assertion para evitar erros de tipo

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res); // Mock da função status que retorna o próprio objeto
  res.json = jest.fn().mockReturnValue(res);   // Mock da função json que retorna o próprio objeto
  return res;
};

// Constantes de teste - dados mockados reutilizáveis em vários testes
const MOCK_USER_DATA = {
  username: "testuser",  // Nome de usuário de teste
  password: "123456",    // Senha de teste
};

const MOCK_USER = {
  id: 1,                 // ID mockado do usuário
  username: "testuser",  // Username mockado
  password: "hashedPassword", // Senha hasheada mockada
};

const MOCK_TOKEN = "fakeJwtToken";    // Token JWT mockado
const MOCK_TOKEN_HASH = "mockedHash"; // Hash do token mockado

// Suite principal de testes para o User Controller
describe("User Controller - Testes com Mocks", () => {
  // Executado antes de cada teste - limpa e configura os mocks
  beforeEach(() => {
    jest.clearAllMocks(); // Limpa todos os mocks para garantir isolamento entre testes

    // Configurações padrão dos mocks - comportamentos comuns para a maioria dos testes
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword"); // Mock do hash sempre retorna senha hasheada
    (bcrypt.compare as jest.Mock).mockResolvedValue(true); // Mock do compare sempre retorna true (senha válida)
    (jwtUtils.generateToken as jest.Mock).mockReturnValue(MOCK_TOKEN); // Mock sempre retorna token fixo
    
    // Mock complexo da verifyToken que varia conforme o token recebido
    (jwtUtils.verifyToken as jest.Mock).mockImplementation(
      (token: string, ignoreExpiration = false) => {
        if (token === "tokenValido") {
          return {
            id: MOCK_USER.id,
            username: MOCK_USER.username,
            exp: Math.floor(Date.now() / 1000) + 3600, // Expira em 1 hora (timestamp atual + 3600 segundos)
          };
        }
        throw new Error("Token inválido"); // Lança erro para tokens inválidos
      }
    );
  });

  // Suite de testes para a função createUser
  describe("createUser", () => {
    it("deve criar usuário com sucesso quando dados são válidos", async () => {
      // Arrange - prepara o ambiente do teste
      const req = mockRequest(MOCK_USER_DATA); // Cria requisição mock com dados do usuário
      const res = mockResponse();              // Cria resposta mock
      (db.query as jest.Mock).mockResolvedValue({}); // Mock do banco retorna sucesso

      // Act - executa a função sendo testada
      await createUser(req, res);

      // Assert - verifica se o comportamento foi o esperado
      expect(bcrypt.hash).toHaveBeenCalledWith(MOCK_USER_DATA.password, 10); // Verifica se hash foi chamado com senha e salt=10

      expect(db.query).toHaveBeenCalledWith(
        "INSERT INTO users (username, password) VALUES ($1, $2)", // SQL esperado
        [MOCK_USER_DATA.username, "hashedPassword"] // Parâmetros esperados
      );

      expect(res.status).toHaveBeenCalledWith(201); // Verifica status 201 (Created)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: "Usuário criado com sucesso." }, // Mensagem de sucesso esperada
      });
    });

    it("deve retornar erro 400 quando username já existe", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      const duplicateError = {
        code: "23505", // Código de erro PostgreSQL para violação de unique constraint
        message: "Nome de usuário já cadastrado",
      };
      (db.query as jest.Mock).mockRejectedValue(duplicateError); // Mock rejeita com erro de duplicidade

      // Act
      await createUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400); // Verifica status 400 (Bad Request)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: duplicateError.message, // Mensagem de erro específica esperada
      });
    });

    it("deve retornar erro 500 quando ocorre erro inesperado", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockRejectedValue(new Error("Erro de banco")); // Mock rejeita com erro genérico

      // Act
      await createUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500); // Verifica status 500 (Internal Server Error)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro ao criar usuário.", // Mensagem de erro genérica esperada
      });
    });
  });

  // Suite de testes para a função loginUser
  describe("loginUser", () => {
    it("deve realizar login com sucesso quando credenciais são válidas", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({
        rows: [MOCK_USER], // Mock retorna usuário encontrado
      });

      // Act
      await loginUser(req, res);

      // Assert
      expect(db.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE username = $1", // SQL esperado para buscar usuário
        [MOCK_USER_DATA.username] // Parâmetro username esperado
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        MOCK_USER_DATA.password, // Senha fornecida
        MOCK_USER.password       // Senha hasheada do banco
      );

      expect(jwtUtils.generateToken).toHaveBeenCalledWith({
        id: MOCK_USER.id,        // Payload esperado para geração do token
        username: MOCK_USER.username,
      });

      expect(res.status).toHaveBeenCalledWith(200); // Verifica status 200 (OK)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: "Login realizado com sucesso.",
          token: MOCK_TOKEN, // Token mockado esperado
          user: { id: MOCK_USER.id, username: MOCK_USER.username }, // Dados do usuário sem senha
        },
      });
    });

    it("deve falhar com 401 se o usuário não for encontrado no banco", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({ rows: [] }); // Mock retorna array vazio (usuário não encontrado)

      // Act
      await loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401); // Verifica status 401 (Unauthorized)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Credenciais inválidas.", // Mensagem de credenciais inválidas
      });
    });

    it("deve retornar erro 401 quando senha é inválida", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockResolvedValue({
        rows: [MOCK_USER], // Usuário encontrado
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Mock retorna false (senha inválida)

      // Act
      await loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401); // Verifica status 401 (Unauthorized)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Credenciais inválidas.", // Mensagem de credenciais inválidas
      });
    });

    it("deve retornar erro 500 quando ocorre erro inesperado", async () => {
      // Arrange
      const req = mockRequest(MOCK_USER_DATA);
      const res = mockResponse();
      (db.query as jest.Mock).mockRejectedValue(new Error("Erro de banco")); // Mock rejeita com erro genérico

      // Act
      await loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500); // Verifica status 500 (Internal Server Error)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro ao realizar login.", // Mensagem de erro genérica
      });
    });
  });

  // Suite de testes para a função logoutUser
  describe("logoutUser", () => {
    it("deve invalidar token com sucesso quando token é válido", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenValido" }); // Requisição com header Authorization
      const res = mockResponse();
      (redisClient.setex as jest.Mock).mockResolvedValue("OK"); // Mock do Redis retorna sucesso

      // Act
      await logoutUser(req, res);

      // Assert
      expect(crypto.createHash).toHaveBeenCalledWith("sha256"); // Verifica se hash SHA256 foi criado
      expect(crypto.createHash("sha256").update).toHaveBeenCalledWith(
        "tokenValido" // Verifica se token foi passado para o hash
      );
      expect(
        crypto.createHash("sha256").update("tokenValido").digest
      ).toHaveBeenCalledWith("hex"); // Verifica se digest foi chamado com hex

      expect(redisClient.setex).toHaveBeenCalledWith(
        `blacklist:jwt:${MOCK_TOKEN_HASH}`, // Chave esperada no Redis
        expect.any(Number), // TTL qualquer (número)
        "true" // Valor esperado
      );

      expect(res.status).toHaveBeenCalledWith(200); // Verifica status 200 (OK)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: "Logout realizado com sucesso. Token invalidado." }, // Mensagem de sucesso
      });
    });

    it("deve retornar erro 401 quando token não é fornecido", async () => {
      // Arrange
      const req = mockRequest({}, {}); // Requisição sem header Authorization
      const res = mockResponse();

      // Act
      await logoutUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401); // Verifica status 401 (Unauthorized)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Token não fornecido", // Mensagem de token não fornecido
      });
    });

    it("deve retornar erro 400 quando token é inválido", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenInvalido" });
      const res = mockResponse();

      // Mock para token que verifica mas não tem expiração (propriedade exp faltando)
      (jwtUtils.verifyToken as jest.Mock).mockReturnValue({
        id: 1,
        username: "testuser",
        // sem propriedade 'exp' - torna o token inválido para logout
      });

      // Act
      await logoutUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400); // Verifica status 400 (Bad Request)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Token inválido", // Mensagem de token inválido
      });
    });

    it("deve retornar erro 500 quando ocorre erro no Redis", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenValido" });
      const res = mockResponse();
      (redisClient.setex as jest.Mock).mockRejectedValue(
        new Error("Erro no Redis") // Mock do Redis rejeita com erro
      );

      // Act
      await logoutUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500); // Verifica status 500 (Internal Server Error)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro ao realizar logout.", // Mensagem de erro genérica
      });
    });

    it("deve aplicar TTL de 60s no Redis ao invalidar token expirado", async () => {
      // Arrange
      const req = mockRequest({}, { authorization: "Bearer tokenExpirado" });
      const res = mockResponse();

      // Mock para token expirado (timestamp no passado)
      (jwtUtils.verifyToken as jest.Mock).mockImplementation(
        (token: string, ignoreExpiration = false) => {
          if (token === "tokenExpirado") {
            return {
              id: MOCK_USER.id,
              username: MOCK_USER.username,
              exp: Math.floor(Date.now() / 1000) - 3600, // Expirou há 1 hora (timestamp no passado)
            };
          }
          throw new Error("Token inválido");
        }
      );

      (redisClient.setex as jest.Mock).mockResolvedValue("OK"); // Mock do Redis retorna sucesso

      // Act
      await logoutUser(req, res);

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        `blacklist:jwt:${MOCK_TOKEN_HASH}`, // Chave esperada no Redis
        60, // TTL de 60 segundos para tokens expirados (fallback)
        "true" // Valor esperado
      );
    });
  });
});