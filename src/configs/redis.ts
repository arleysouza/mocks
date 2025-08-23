import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT);
const redisPassword = process.env.REDIS_PASSWORD;

// Monta opções dinamicamente
const redisOptions: RedisOptions = {
  host: redisHost,
  port: redisPort,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

// Só adiciona a senha se estiver definida
if (redisPassword) {
  redisOptions.password = redisPassword;
}

const redisClient = new Redis(redisOptions);

// Eventos de log (opcional)
//redisClient.on("connect", () => console.log("Redis conectado com sucesso!"));
redisClient.on("error", (err) => console.error("Erro no Redis:", err));

export default redisClient;
