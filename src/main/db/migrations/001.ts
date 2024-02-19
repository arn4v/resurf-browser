import { sql } from 'kysely'
import type { DbInstance } from '../db'

export async function up(db: DbInstance) {
  await db.schema
    .createTable('tab')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('current_url', 'text', (col) => col.notNull())
    .addColumn('is_open', 'boolean', (col) => col.notNull())
    .addColumn('created_at', 'datetime', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable('event')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo({}))
    .addColumn('created_at', 'datetime', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable('visited_url')
    .ifNotExists()
    .addColumn('url', 'text', (c) => c.primaryKey())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('content', 'text', (c) => c.notNull())
    .execute()

  await sql`CREATE VIRTUAL TABLE visited_url USING fts5(url, title, content)`.execute(db)
}

export async function down(db: DbInstance) {}
