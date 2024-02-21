import SQLite from 'better-sqlite3'
import { app } from 'electron'
import {
  Kysely,
  Migration,
  MigrationProvider,
  Migrator,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely'
import path from 'path'
import * as migration_001 from './migrations/001'
import { Database } from './types'

export type DbInstance = Kysely<Database>

export function getDatabaseLocation() {
  return path.join(app.getPath('userData'), 'resurf.db')
}

function getSqlite() {
  return new SQLite(getDatabaseLocation())
}

export function createDb() {
  const dialect = new SqliteDialect({
    database: getSqlite(),
  })

  return new Kysely<Database>({
    dialect,
    plugins: [new ParseJSONResultsPlugin()],
  })
}

class CustomMigrationProvider implements MigrationProvider {
  constructor(
    private migrations: Array<{
      name: string
      migration: Migration
    }>,
  ) {}
  async getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Migration> = {}

    for (const migration of this.migrations) {
      migrations[migration.name] = migration.migration
    }

    return migrations
  }
}

export async function migrateToLatest() {
  const db = createDb()

  const migrator = new Migrator({
    db,
    provider: new CustomMigrationProvider([
      {
        name: '001',
        migration: migration_001,
      },
    ]),
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}
