## Testes com Mocks em Node.js e Jest

Este projeto exemplifica o uso de mocks em uma aplicação Node.js/TypeScript com Express, simulando dependências externas como banco de dados, Redis e autenticação JWT.
Em vez de subir serviços reais, usamos o Jest para criar funções e módulos simulados, isolando a lógica da aplicação e permitindo executar testes de forma rápida e previsível.

---


### 📌 Objetivo

O foco do repositório é demonstrar boas práticas no uso de mocks:
- Como isolar a lógica da aplicação de suas dependências externas;
- Como substituir chamadas reais a banco de dados, Redis e JWT por simulações controladas;
- Como aplicar o padrão AAA (Arrange – Act – Assert) na escrita dos testes.

---


🧑‍💻 Tecnologias Utilizadas

- Node.js + TypeScript – aplicação principal
- Express – servidor HTTP
- Docker + Docker Compose – orquestração dos serviços de teste
- Jest – framework de testes
- bcrypt / JWT – simulados nos testes por meio de mocks

---


### 📂 Estrutura de Pastas

```bash
app/
├── src/                     # Código da aplicação
│   ├── configs/             # Conexões (Postgres, Redis) – não usadas nos mocks
│   ├── controllers/         # Controllers (ex: user.controller.ts)
│   ├── middlewares/         # Middlewares (auth, validação, erros)
│   ├── routes/              # Rotas Express
│   ├── types/               # Tipagem customizada
│   ├── utils/               # Funções auxiliares (ex: JWT)
│   └── index.ts             # Inicialização do servidor
│
├── tests/                   # Casos de teste
│   └── controllers/         # Testes dos controllers com mocks
│
├── .env                     # Configurações de desenvolvimento
├── jest.config.ts           # Configuração do Jest
└── tsconfig.json

```


---

### Execução do projeto

1. Clonando o repositório e instalando as dependências:
```bash
git clone https://github.com/arleysouza/mocks.git app
cd app
npm i
```

2. Configurando o BD PostgreSQL
- Crie um BD chamado `bdaula` no PostgreSQL (ou outro nome de sua preferência);
- Atualize o arquivo `.env` com os dados de acesso ao banco;

3. Execute os comandos SQL presentes no arquivo `src/configs/comandos.sql` para criar as tabelas necessárias;

4. Subir o Redis com Docker
```bash
docker run --name redis -p 6379:6379 -d redis:alpine redis-server --requirepass 123
```
ou

```bash
npm run redis-start
```

5. Iniciando o servidor
```
npm start
npm run dev
```

6. Executando os testes
Como não há containers externos, os testes com mocks rodam diretamente:
```bash
npm run test
```
Não existe a necessidade subir o container para rodar os testes `npm run redis-start`.

---


### ▶️ Testando a API com REST Client

O arquivo `/http/requests.http` contém as requisições da aplicação (login, registro, logout).
Para executá-las diretamente no VSCode, instale a extensão:

👉 REST Client (autor: Huachao Mao)

Após instalar, basta abrir o arquivo `requests.http`, clicar em `Send Request` sobre a requisição desejada, e o VSCode mostrará a resposta no editor.

---

### 🔑 Endpoints

**Registro de usuário**
``` bash
POST /users
```

**Login**
``` bash
POST /users/login
```
Resposta (exemplo):
```bash
{ "token": "eyJhbG..." }
```

**Logout**
``` bash
POST /users/logout
```
Nos testes mockados, banco de dados, Redis e JWT são substituídos por simulações.
Isso permite validar a lógica dos controllers sem depender de infraestrutura real.

---


### 📌 Boas práticas aplicadas

- Testes organizados em pasta `tests/` (separados do código da aplicação).
- Uso de mocks para simular dependências externas.
- Aplicação do padrão AAA (Arrange – Act – Assert).
- Casos de sucesso e falha cobertos (duplicidade de usuário, senha inválida, falha no Redis, token expirado).
- Execução rápida e independente de containers externos.