import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/momu';

const sql = postgres(connectionString);

export default sql;
