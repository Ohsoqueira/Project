import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __servicebox_db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __servicebox_sql__: postgres.Sql | undefined;
}

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL env var is required");
  return url;
}

const client = global.__servicebox_sql__ ?? postgres(connectionString(), { max: 10 });
export const db = global.__servicebox_db__ ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  global.__servicebox_sql__ = client;
  global.__servicebox_db__ = db;
}
