import { hashPassword } from './lib/password';

async function test() {
    const password = "kh12345";
    console.log(`Testing password: ${password}`);
    try {
        const hash = await hashPassword(password);
        console.log(`Success! Hash: ${hash}`);
    } catch (err: any) {
        console.error('Caught error (expected):', err.message);
    }
}

test();
