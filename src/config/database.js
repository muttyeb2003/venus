import 'dotenv/config';

import {neon} from "@neondatabase/serverless";
import {drizzle} from 'drizzle-orm/neon-http';

cosnt sql = neon(process.env.DATABASE_URL);

cosnt db = drizzle(sql);

export {db, sql};