import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/models/*.js',
  out: './drizzle',
  dbCredentials: {
    host: 'neon-local',
    port: 5432,
    user: 'neon',
    password: 'npg',
    database: 'neondb',
    ssl: false,
  },
});
