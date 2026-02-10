import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Env Path:', envPath);
console.log('Exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('Dotenv Error:', result.error);
    } else {
        console.log('Dotenv loaded successfully');
    }
}

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND');
if (process.env.DATABASE_URL) {
    console.log('Value starts with:', process.env.DATABASE_URL.substring(0, 15));
}
