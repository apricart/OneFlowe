# Database Export/Import Guide

This guide explains how to export and import the database for sharing with other developers.

## Exporting the Database

To export the current database to a SQL file:

```bash
npm run db:export
```

This will create a file named `database-export-YYYY-MM-DD.sql` in the project root.

You can also specify a custom filename:

```bash
npm run db:export my-database-backup.sql
```

### What's Included

The export includes:
- ✅ All database schema (tables, indexes, constraints)
- ✅ All data (rows from all tables)
- ✅ Clean commands (DROP statements before CREATE)
- ✅ No ownership/ACL commands (portable across users)

## Importing the Database

### Prerequisites

1. PostgreSQL must be installed and running
2. You must have a database created (or create one)
3. You must have the `psql` command-line tool available

### Steps to Import

1. **Create a new database** (if needed):
   ```bash
   createdb oneflowe
   ```

2. **Import the SQL file**:
   ```bash
   psql -d oneflowe -f database-export-2025-12-06.sql
   ```

   Or if you need to specify connection details:
   ```bash
   psql -h localhost -p 5433 -U your_username -d oneflowe -f database-export-2025-12-06.sql
   ```

3. **Update your `.env.local` file** with your database connection:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/oneflowe
   ```

4. **Verify the import**:
   ```bash
   npm run db:studio
   ```
   This will open Drizzle Studio where you can browse the imported data.

## Alternative: Using pgAdmin or GUI Tools

If you prefer a GUI tool:

1. Open pgAdmin (or your preferred PostgreSQL GUI)
2. Right-click on your database → "Restore..."
3. Select the SQL file
4. Click "Restore"

## Troubleshooting

### Error: "pg_dump: command not found"

**Solution**: Install PostgreSQL client tools:
- **Windows**: Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
- **macOS**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql-client` (Ubuntu/Debian)

### Error: "database does not exist"

**Solution**: Create the database first:
```bash
createdb oneflowe
```

### Error: "permission denied"

**Solution**: Make sure your database user has the necessary permissions, or use a superuser account.

### Error: "connection refused"

**Solution**: 
- Check that PostgreSQL is running: `pg_isready`
- Verify your connection details in `.env.local`
- Check firewall settings if connecting to a remote database

## Notes

- The exported SQL file contains all data, so be careful when sharing (may contain sensitive information)
- The export uses `--clean` flag, which means it will drop existing objects before creating them
- The export uses `--no-owner` and `--no-acl` flags for portability across different PostgreSQL installations
- File size will vary based on the amount of data in your database

## Sharing with Team Members

1. Export the database: `npm run db:export`
2. Share the generated `.sql` file (via secure file sharing, version control, etc.)
3. Team members can import it using the steps above

**⚠️ Security Note**: Database exports may contain sensitive data. Ensure you're sharing through secure channels and consider data sanitization for production data.

