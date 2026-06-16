-- 001_extensions.sql
-- Habilitar extensiones necesarias para el sistema

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
