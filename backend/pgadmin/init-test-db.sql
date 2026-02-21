-- Creates the test database if it doesn't exist.
-- Mounted into Postgres via docker-compose as an init script.
SELECT 'CREATE DATABASE movie_app_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'movie_app_test');
\gexec
