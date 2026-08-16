// Usage: npx tsx scripts/hashPassword.ts "your-password-here"
// Prints a bcrypt hash to put into the ADMIN_PASSWORD_HASH env var.
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx tsx scripts/hashPassword.ts "your-password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
