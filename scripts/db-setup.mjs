/**
 * Script utilitário de migração e seed automático para o PostgreSQL/Supabase.
 * Lê a connection string de DATABASE_URL (em .env.local) ou de .agents/mcp_config.json
 * e executa:
 *   1. supabase/migrations/001_initial_schema.sql (Tabelas public + RLS)
 *   2. supabase/seed.sql (Grupo Familiar + Usuários Yan e Larissa)
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

function resolveDatabaseUrl() {
  // 1. Tenta ler do .env.local
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    if (match && match[1] && !match[1].includes('[') && !match[1].includes(']')) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  // 2. Tenta ler de .agents/mcp_config.json
  const mcpPath = path.join(process.cwd(), '.agents', 'mcp_config.json');
  if (fs.existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      const args = mcp?.mcpServers?.postgres?.args || [];
      const connStr = args.find((a) => typeof a === 'string' && a.startsWith('postgresql://'));
      if (connStr && !connStr.includes('[') && !connStr.includes(']')) {
        return connStr;
      }
    } catch {
      // ignore
    }
  }

  return process.env.DATABASE_URL || null;
}

async function run() {
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    console.log('⚠️  Nenhuma connection string real encontrada ainda.');
    console.log(
      '👉 Preencha a connection string em .agents/mcp_config.json ou DATABASE_URL no .env.local e rode: npm run db:setup'
    );
    process.exit(0);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Conectando ao PostgreSQL do Supabase...');
    await client.connect();

    const schemaSql = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql'),
      'utf-8'
    );
    console.log('📦 Executando 001_initial_schema.sql (Tabelas public + RLS)...');
    await client.query(schemaSql);

    const seedSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'seed.sql'), 'utf-8');
    console.log('🌱 Executando seed.sql (Grupo Familiar + Usuários Yan e Larissa)...');
    await client.query(seedSql);

    const expensesMigrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '002_expenses_table_and_rls.sql'
    );
    if (fs.existsSync(expensesMigrationPath)) {
      const expensesSql = fs.readFileSync(expensesMigrationPath, 'utf-8');
      console.log('📊 Executando 002_expenses_table_and_rls.sql (Tabela expenses + RLS + Seed de Gastos)...');
      await client.query(expensesSql);
    }

    const goalsMigrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '003_goals_table_and_rls.sql'
    );
    if (fs.existsSync(goalsMigrationPath)) {
      const goalsSql = fs.readFileSync(goalsMigrationPath, 'utf-8');
      console.log('🎮 Executando 003_goals_table_and_rls.sql (Tabela goals + RLS + Missão PS5)...');
      await client.query(goalsSql);
    }

    const priceHistoryMigrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '004_price_history_table_and_rls.sql'
    );
    if (fs.existsSync(priceHistoryMigrationPath)) {
      const phSql = fs.readFileSync(priceHistoryMigrationPath, 'utf-8');
      console.log('📈 Executando 004_price_history_table_and_rls.sql (Tabela price_history + RLS)...');
      await client.query(phSql);
    }

    console.log('✅ Banco de dados configurado e populado com sucesso (Passos 1 a 5 completos)!');
  } catch (err) {
    console.error('❌ Erro ao executar migração/seed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
