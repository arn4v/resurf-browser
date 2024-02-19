import { Database } from './types'
import SQLite from 'better-sqlite3'
import {
  Kysely,
  SqliteDialect,
  MigrationProvider,
  Migration,
  Migrator,
  ParseJSONResultsPlugin,
  KyselyPlugin,
  PluginTransformQueryArgs,
  RootOperationNode,
  PluginTransformResultArgs,
  QueryResult,
  UnknownRow,
} from 'kysely'
import * as migration_001 from './migrations/001'
import { app } from 'electron'
import path from 'path'

export type DbInstance = Kysely<Database>

export function getDatabaseLocation() {
  return path.join(app.getPath('userData'), 'resurf.db')
}

export function createDb() {
  const dialect = new SqliteDialect({
    database: new SQLite(getDatabaseLocation()),
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

async function migrateToLatest() {
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

migrateToLatest()
