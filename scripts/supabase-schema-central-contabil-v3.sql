-- ==============================================================================
-- CENTRAL CONTÁBIL v3.0 — SCRIPT DE DEPLOY E MIGRAÇÃO SUPABASE
-- Domínio Oficial: makerpixeltech.com.br
-- Compatibilidade: PostgreSQL 15+ / Supabase com Row Level Security (RLS)
-- ==============================================================================

-- 1. Extensões Obrigatórias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Esquema e Funções Globais
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TABELAS DE GESTÃO MULTI-TENANT & PLANOS (MAKERPIXEL TECH)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS mp_planos (
  id VARCHAR(50) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  limite_usuarios INT NOT NULL DEFAULT 2,
  limite_empresas INT NOT NULL DEFAULT 20,
  limite_armazenamento_gb INT NOT NULL DEFAULT 5,
  modulos_habilitados JSONB NOT NULL DEFAULT '["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"]'::jsonb,
  destaque BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mp_escritorios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14),
  contato VARCHAR(150),
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(50),
  cidade VARCHAR(100) DEFAULT 'Tubarão',
  uf VARCHAR(2) DEFAULT 'SC',
  situacao VARCHAR(30) NOT NULL DEFAULT 'TESTE', -- TESTE, ATIVO, VENCIDO, SUSPENSO, ENCERRADO
  plano_id VARCHAR(50) REFERENCES mp_planos(id) DEFAULT 'plano-escritorio',
  teste_expira_em TIMESTAMPTZ,
  contrato_inicio TIMESTAMPTZ,
  contrato_fim TIMESTAMPTZ,
  modulos_ativos JSONB DEFAULT '["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mp_usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  auth_user_id UUID, -- Link opcional com auth.users do Supabase
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  perfil VARCHAR(50) NOT NULL DEFAULT 'operador', -- admin, operador, suporte, cliente
  areas_permitidas JSONB DEFAULT '["integracao", "conciliacao", "mod-vencimentos", "mod-em-dia", "contabil-lucros", "mod-iss", "mod-icms", "mod-horas", "mod-ibs-cbs", "mod-notasync", "mod-danfse", "mod-xml-excel"]'::jsonb,
  trocar_senha BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mp_empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  cnpj VARCHAR(14) NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  regime_tributario VARCHAR(50) DEFAULT 'SIMPLES_NACIONAL',
  inscricao_estadual VARCHAR(50),
  inscricao_municipal VARCHAR(50),
  cidade VARCHAR(100) DEFAULT 'Tubarão',
  uf VARCHAR(2) DEFAULT 'SC',
  ativo BOOLEAN DEFAULT true,
  monitoramento_notasync BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_escritorio_cnpj UNIQUE(escritorio_id, cnpj)
);

-- ==============================================================================
-- TABELAS NOTASYNC (SEF/SC, DF-e & COFRE DE CERTIFICADOS A1)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS notasync_cofre_certificados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES mp_empresas(id) ON DELETE SET NULL,
  titular_mascarado VARCHAR(255) NOT NULL,
  documento_mascarado VARCHAR(30) NOT NULL,
  tipo_certificado VARCHAR(20) NOT NULL, -- E_CNPJ, E_CPF
  emissor VARCHAR(255),
  valido_de TIMESTAMPTZ NOT NULL,
  valido_ate TIMESTAMPTZ NOT NULL,
  pfx_cifrado BYTEA NOT NULL,
  senha_cifrada BYTEA NOT NULL,
  nonce_pfx BYTEA NOT NULL,
  nonce_senha BYTEA NOT NULL,
  versao_chave_mestra INT NOT NULL DEFAULT 1,
  sha256_original VARCHAR(64) NOT NULL,
  termo_aceite_versao VARCHAR(20) DEFAULT '1.0',
  termo_aceite_em TIMESTAMPTZ DEFAULT NOW(),
  termo_aceite_ip VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notasync_documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES mp_empresas(id) ON DELETE SET NULL,
  chave_acesso VARCHAR(44) NOT NULL,
  modelo VARCHAR(10) NOT NULL DEFAULT '65', -- 65=NFC-e, 55=NF-e, 57=CT-e, NFS-e
  numero VARCHAR(20),
  serie VARCHAR(10),
  data_emissao TIMESTAMPTZ,
  emitente_cnpj VARCHAR(14),
  emitente_nome VARCHAR(255),
  destinatario_cnpj VARCHAR(14),
  destinatario_nome VARCHAR(255),
  valor_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  valor_produtos NUMERIC(15, 2) DEFAULT 0.00,
  valor_icms NUMERIC(15, 2) DEFAULT 0.00,
  valor_iss NUMERIC(15, 2) DEFAULT 0.00,
  valor_cbs NUMERIC(15, 2) DEFAULT 0.00,
  valor_ibs NUMERIC(15, 2) DEFAULT 0.00,
  situacao VARCHAR(30) NOT NULL DEFAULT 'AUTORIZADA', -- AUTORIZADA, CANCELADA, DENEGADA, SUBSTITUIDA
  nsu BIGINT,
  storage_path_xml TEXT, -- Referência para Supabase Storage (se persistido em bucket)
  conteudo_xml TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_escritorio_chave UNIQUE(escritorio_id, chave_acesso)
);

CREATE TABLE IF NOT EXISTS notasync_execucoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES mp_empresas(id) ON DELETE SET NULL,
  inicio TIMESTAMPTZ DEFAULT NOW(),
  fim TIMESTAMPTZ,
  fonte VARCHAR(50) NOT NULL, -- SEF_SC_NFCE, SEF_SC_NFE, DFE_NACIONAL
  cstat INT,
  motivo_status TEXT,
  quantidade_baixada INT DEFAULT 0,
  ultimo_nsu BIGINT,
  sucesso BOOLEAN DEFAULT true,
  erro_detalhe TEXT
);

CREATE TABLE IF NOT EXISTS notasync_auditoria_acessos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES mp_usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(100) NOT NULL, -- UPLOAD_CERTIFICADO, CONSULTA_SEF, EXPORTACAO_ZIP, EXCLUSAO_CERTIFICADO
  ip VARCHAR(50),
  user_agent TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABELAS REFORMA TRIBUTÁRIA (AUDITOR IBS/CBS & MOTOR RTC - LC 214/2025)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS reforma_lote (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES mp_empresas(id) ON DELETE SET NULL,
  nome_lote VARCHAR(255) NOT NULL,
  competencia VARCHAR(7), -- AAAA-MM
  total_itens INT DEFAULT 0,
  total_ok INT DEFAULT 0,
  total_divergencias INT DEFAULT 0,
  total_invalidos INT DEFAULT 0,
  total_sem_grupo INT DEFAULT 0,
  total_erros INT DEFAULT 0,
  valor_faturamento NUMERIC(15, 2) DEFAULT 0.00,
  valor_cbs_destacada NUMERIC(15, 2) DEFAULT 0.00,
  valor_cbs_calculada NUMERIC(15, 2) DEFAULT 0.00,
  valor_ibs_destacado NUMERIC(15, 2) DEFAULT 0.00,
  valor_ibs_calculado NUMERIC(15, 2) DEFAULT 0.00,
  diferenca_total NUMERIC(15, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reforma_item (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id UUID NOT NULL REFERENCES reforma_lote(id) ON DELETE CASCADE,
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  chave_acesso VARCHAR(44),
  numero_nota VARCHAR(20),
  n_item INT NOT NULL,
  codigo_produto VARCHAR(100),
  descricao TEXT,
  ncm VARCHAR(10),
  cfop VARCHAR(10),
  valor_item NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  base_calculo NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  cst_informado VARCHAR(10),
  cclass_trib_informado VARCHAR(20),
  cst_oficial VARCHAR(10),
  cclass_trib_oficial VARCHAR(20),
  reducao_legal_pct NUMERIC(5, 2) DEFAULT 0.00,
  cbs_destacada NUMERIC(15, 2) DEFAULT 0.00,
  cbs_calculada NUMERIC(15, 2) DEFAULT 0.00,
  ibs_uf_destacado NUMERIC(15, 2) DEFAULT 0.00,
  ibs_uf_calculado NUMERIC(15, 2) DEFAULT 0.00,
  ibs_mun_destacado NUMERIC(15, 2) DEFAULT 0.00,
  ibs_mun_calculado NUMERIC(15, 2) DEFAULT 0.00,
  classificacao VARCHAR(40) NOT NULL, -- OK, DIVERGENCIA_VALOR, ENQUADRAMENTO_INVALIDO, SEM_GRUPO_IBSCBS, ERRO_CALCULO
  motivo_divergencia TEXT,
  acao_recomendada TEXT,
  memoria_calculo TEXT,
  fundamentacao_legal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABELAS DE CONCILIAÇÃO BANCÁRIA COM IA & DEPARTAMENTO CADASTRO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS contabil_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES mp_empresas(id) ON DELETE CASCADE,
  banco_codigo VARCHAR(10) NOT NULL, -- 001=BB, 341=Itaú, 260=Nubank, 136=Unicred
  banco_nome VARCHAR(100) NOT NULL,
  agencia VARCHAR(20),
  conta_numero VARCHAR(30) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  saldo_inicial NUMERIC(15, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contabil_extratos_lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES contabil_contas_bancarias(id) ON DELETE CASCADE,
  data_movimento DATE NOT NULL,
  descricao TEXT NOT NULL,
  documento VARCHAR(50),
  tipo VARCHAR(1) NOT NULL, -- C=Crédito, D=Débito
  valor NUMERIC(15, 2) NOT NULL,
  saldo NUMERIC(15, 2),
  conciliado BOOLEAN DEFAULT false,
  conciliado_com_id UUID,
  motivo_regra TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadastro_obrigacoes_alvaras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escritorio_id UUID NOT NULL REFERENCES mp_escritorios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES mp_empresas(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- ALVARA_FUNCIONAMENTO, BOMBEIROS, VIGILANCIA_SANITARIA, AMBIENTAL, CND_FEDERAL, CND_ESTADUAL, CND_MUNICIPAL, CRF_FGTS
  orgao_emissor VARCHAR(150),
  numero_protocolo VARCHAR(100),
  data_emissao DATE,
  data_vencimento DATE NOT NULL,
  situacao VARCHAR(30) DEFAULT 'REGULAR', -- REGULAR, VENCIDO, VENCENDO_7_DIAS, VENCENDO_30_DIAS
  storage_path_documento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TRIGGERS DE UPDATED_AT
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mp_escritorios_upd') THEN
    CREATE TRIGGER trg_mp_escritorios_upd BEFORE UPDATE ON mp_escritorios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mp_usuarios_upd') THEN
    CREATE TRIGGER trg_mp_usuarios_upd BEFORE UPDATE ON mp_usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mp_empresas_upd') THEN
    CREATE TRIGGER trg_mp_empresas_upd BEFORE UPDATE ON mp_empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notasync_doc_upd') THEN
    CREATE TRIGGER trg_notasync_doc_upd BEFORE UPDATE ON notasync_documentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ==============================================================================
-- ÍNDICES DE PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_mp_empresas_escritorio ON mp_empresas(escritorio_id);
CREATE INDEX IF NOT EXISTS idx_mp_empresas_cnpj ON mp_empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_notasync_docs_chave ON notasync_documentos(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_notasync_docs_escritorio ON notasync_documentos(escritorio_id);
CREATE INDEX IF NOT EXISTS idx_notasync_docs_emissao ON notasync_documentos(data_emissao);
CREATE INDEX IF NOT EXISTS idx_notasync_docs_emitente ON notasync_documentos(emitente_cnpj);
CREATE INDEX IF NOT EXISTS idx_notasync_exec_escritorio ON notasync_execucoes(escritorio_id, inicio DESC);
CREATE INDEX IF NOT EXISTS idx_reforma_item_lote ON reforma_item(lote_id);
CREATE INDEX IF NOT EXISTS idx_reforma_item_classificacao ON reforma_item(classificacao);
CREATE INDEX IF NOT EXISTS idx_extratos_conta_data ON contabil_extratos_lancamentos(conta_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_alvaras_vencimento ON cadastro_obrigacoes_alvaras(empresa_id, data_vencimento);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) PARA ISOLAMENTO MULTI-TENANT SEGURO
-- ==============================================================================

ALTER TABLE mp_escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notasync_cofre_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE notasync_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notasync_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notasync_auditoria_acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reforma_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE reforma_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabil_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabil_extratos_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_obrigacoes_alvaras ENABLE ROW LEVEL SECURITY;

-- Políticas de isolamento por escritório ativo (compatível com header app.current_escritorio_id ou JWT claim)
CREATE OR REPLACE FUNCTION current_escritorio_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_escritorio_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE POLICY rls_mp_empresas ON mp_empresas
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY rls_notasync_documentos ON notasync_documentos
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY rls_reforma_lote ON reforma_lote
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY rls_reforma_item ON reforma_item
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY rls_contabil_contas ON contabil_contas_bancarias
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY rls_contabil_extratos ON contabil_extratos_lancamentos
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY rls_cadastro_alvaras ON cadastro_obrigacoes_alvaras
  USING (escritorio_id = current_escritorio_id() OR current_setting('app.is_super_admin', true) = 'true');

-- ==============================================================================
-- CARGA INICIAL (SEEDS DE PLANOS OFICIAIS)
-- ==============================================================================

INSERT INTO mp_planos (id, nome, descricao, limite_usuarios, limite_empresas, limite_armazenamento_gb, destaque)
VALUES 
  ('plano-essencial', 'Essencial', 'Ideal para contadores autônomos e pequenos escritórios', 2, 20, 5, false),
  ('plano-escritorio', 'Escritório', 'Para escritórios de contabilidade com equipe ativa (Mais Escolhido)', 5, 60, 20, true),
  ('plano-escritorio-plus', 'Corporativo Enterprise', 'Para grandes escritórios com alto volume de notas e clientes', 15, 180, 100, false)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  limite_usuarios = EXCLUDED.limite_usuarios,
  limite_empresas = EXCLUDED.limite_empresas,
  limite_armazenamento_gb = EXCLUDED.limite_armazenamento_gb,
  destaque = EXCLUDED.destaque;

-- Fim do script de deploy Supabase
