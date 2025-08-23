-- Remove tabelas e tipos anteriores (garantia de reexecução do script)
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL NOT NULL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    CONSTRAINT users_username_unique UNIQUE (username)
);

-- Função para tratar a duplicidade
-- O USING ERRCODE = 'unique_violation' mantém o código de erro do PostgreSQL para integridade de chave única (23505), o que ajuda se o backend quiser tratar por código.
CREATE OR REPLACE FUNCTION check_unique_username()
RETURNS TRIGGER AS $$
BEGIN
	-- Verifica se já existe username igual
    IF EXISTS (SELECT 1 FROM users WHERE username = NEW.username) THEN
        RAISE EXCEPTION 'O nome de usuário "%" já está cadastrado. Escolha outro.', NEW.username
            USING ERRCODE = 'unique_violation'; -- código de violação de chave única
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar username único antes de inserir ou atualizar
CREATE TRIGGER trg_check_unique_username
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION check_unique_username();

