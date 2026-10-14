-- Roda uma única vez, na primeira inicialização do volume (docker-entrypoint-initdb.d).
-- O banco "cardify" já é criado pela imagem via POSTGRES_DB.
CREATE DATABASE cardify_test;
