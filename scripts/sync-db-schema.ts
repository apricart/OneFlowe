import { Client } from 'pg';

const DB1_URL = 'postgresql://postgres.gkhrumlxtrydbtnyeyts:root@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const DB2_URL = 'postgresql://postgres.ofqbofqxvztwmhsezrpv:Hitandrun%40%3F%3F123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

async function getColumns(client: Client): Promise<ColumnInfo[]> {
  const res = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position
  `);
  return res.rows;
}

async function getTables(client: Client): Promise<string[]> {
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return res.rows.map((r: any) => r.table_name);
}

function buildColumnType(col: ColumnInfo): string {
  let type = col.data_type;
  if (type === 'character varying' && col.character_maximum_length) {
    type = `varchar(${col.character_maximum_length})`;
  } else if (type === 'character varying') {
    type = 'varchar';
  }
  return type;
}

async function run() {
  const db1 = new Client({ connectionString: DB1_URL, ssl: { rejectUnauthorized: false } });
  const db2 = new Client({ connectionString: DB2_URL, ssl: { rejectUnauthorized: false } });

  try {
    await db1.connect();
    console.log('✓ Connected to DB1 (ap-southeast-1 / Source)');
    await db2.connect();
    console.log('✓ Connected to DB2 (ap-northeast-2 / Target)');

    const db1Tables = await getTables(db1);
    const db2Tables = await getTables(db2);
    const db1Columns = await getColumns(db1);
    const db2Columns = await getColumns(db2);

    // Filter out Supabase internal tables
    const skipTables = new Set(['schema_migrations', 'mfa_amr_claims', 'mfa_challenges', 'mfa_factors',
      'sso_providers', 'sso_domains', 'saml_providers', 'saml_relay_states', 'flow_state',
      'identities', 'instances', 'refresh_tokens', 'one_time_tokens', '__drizzle_migrations']);

    // Build lookup maps
    const db2ColumnMap = new Map<string, Set<string>>();
    for (const col of db2Columns) {
      if (!db2ColumnMap.has(col.table_name)) db2ColumnMap.set(col.table_name, new Set());
      db2ColumnMap.get(col.table_name)!.add(col.column_name);
    }

    const db2TableSet = new Set(db2Tables);
    const alterStatements: string[] = [];

    console.log('\n--- Schema Differences ---\n');

    // Find missing tables in DB2
    for (const table of db1Tables) {
      if (skipTables.has(table)) continue;
      if (table.startsWith('_')) continue; // skip internal tables

      if (!db2TableSet.has(table)) {
        console.log(`⚠ TABLE MISSING in DB2: "${table}" (exists in DB1 but not in DB2)`);
        // We won't auto-create tables - too complex with FKs. Just report.
        continue;
      }
    }

    // Find missing columns in DB2
    for (const col of db1Columns) {
      if (skipTables.has(col.table_name)) continue;
      if (col.table_name.startsWith('_')) continue;
      if (!db2TableSet.has(col.table_name)) continue; // table doesn't exist in DB2, skip

      const db2Cols = db2ColumnMap.get(col.table_name);
      if (!db2Cols || !db2Cols.has(col.column_name)) {
        const colType = buildColumnType(col);
        const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        
        const stmt = `ALTER TABLE "${col.table_name}" ADD COLUMN "${col.column_name}" ${colType}${nullable}${defaultVal};`;
        alterStatements.push(stmt);
        console.log(`+ MISSING COLUMN: "${col.table_name}"."${col.column_name}" (${colType})`);
      }
    }

    if (alterStatements.length === 0) {
      console.log('\n✓ Both databases are already in sync! No missing columns found.');
      return;
    }

    console.log(`\n--- Applying ${alterStatements.length} ALTER statements to DB2 ---\n`);

    let success = 0;
    let failed = 0;
    for (const stmt of alterStatements) {
      try {
        await db2.query(stmt);
        console.log(`✓ ${stmt}`);
        success++;
      } catch (err: any) {
        if (err.code === '42701') {
          // Column already exists - skip
          console.log(`⊘ Already exists, skipping: ${stmt}`);
        } else {
          console.error(`✗ FAILED: ${stmt}`);
          console.error(`  Error: ${err.message}`);
          failed++;
        }
      }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Successfully added: ${success}`);
    console.log(`Already existed: ${alterStatements.length - success - failed}`);
    console.log(`Failed: ${failed}`);

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db1.end();
    await db2.end();
  }
}

run();
