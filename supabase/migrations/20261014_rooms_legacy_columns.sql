-- A tabela rooms em produção nasceu com colunas camelCase NOT NULL ("worldId", "worldName", "hostId", "hostName", "code")
-- e a migração 20261013_safe_migration.sql acrescentou as minúsculas (worldid...) ao lado. O cliente grava nas minúsculas,
-- então criar sala falhava com: null value in column "worldId" violates not-null constraint.
-- Esta migração torna as colunas antigas opcionais (nada é apagado; o cliente já grava as duas enquanto isto não roda).
ALTER TABLE public.rooms ALTER COLUMN "worldId" DROP NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN "worldName" DROP NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN "hostId" DROP NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN "hostName" DROP NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN "code" DROP NOT NULL;
