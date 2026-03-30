import { Client } from 'pg';

async function testInsert() {
  const connectionString = "postgresql://postgres.ofqbofqxvztwmhsezrpv:Hitandrun%40%3F%3F123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log("Attempting to insert a user with potentially duplicate fields...");
    // We'll use a unique username to avoid that constraint
    const testUsername = "test_user_unique_" + Date.now();
    
    // We'll use an email and employee_id that likely already exist or are duplicates
    const query = `
      INSERT INTO public.users (
        id, email, username, password_hash, role_id, is_active, full_name, first_name, last_name, employee_id
      ) VALUES (
        gen_random_uuid(), 'duplicate@example.com', '${testUsername}', 'hash', 1, true, 'Test User', 'Test', 'User', 'EMP123'
      ) RETURNING id;
    `;
    
    try {
      const res = await client.query(query);
      console.log("First insert successful:", res.rows[0].id);
      
      console.log("Attempting second insert with SAME email and SAME employee_id...");
      const testUsername2 = "test_user_unique_2_" + Date.now();
      const res2 = await client.query(`
        INSERT INTO public.users (
          id, email, username, password_hash, role_id, is_active, full_name, first_name, last_name, employee_id
        ) VALUES (
          gen_random_uuid(), 'duplicate@example.com', '${testUsername2}', 'hash', 1, true, 'Test User 2', 'Test', 'User', 'EMP123'
        ) RETURNING id;
      `);
      console.log("Second insert successful! Email/EmployeeID are NOT unique.");
      
      // Cleanup
      await client.query("DELETE FROM public.users WHERE email = 'duplicate@example.com'");
      console.log("Cleanup done.");
      
    } catch (err: any) {
      console.error("INSERT FAILED!");
      console.error("Error Code:", err.code);
      console.error("Error Detail:", err.detail);
      console.error("Error Message:", err.message);
      console.error("Full Error:", err);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

testInsert();
