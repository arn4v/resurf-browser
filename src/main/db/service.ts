import { Kysely, SqliteDialect } from 'kysely'
import { Database, NewEvent, NewTab, NewVisitedURL, TabUpdate } from './types'
import Sqlite3 from 'better-sqlite3'
import { createDb } from './db'

export class DatabaseService {
  db = createDb()

  static instance: DatabaseService

  getInstance() {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  async upsertVisitedUrl(update: NewVisitedURL) {
    await this.db
      .insertInto('visited_url')
      .values(update)
      .onConflict((oc) => oc.column('url').doUpdateSet(update))
      .execute()
  }

  async insertTab(tab: NewTab) {
    return await this.db.insertInto('tab').values(tab).executeTakeFirst()
  }

  async updateTab(id: number, update: Omit<TabUpdate, 'id' | 'created_at'>) {
    return await this.db.updateTable('tab').set(update).where('id', '=', id).executeTakeFirst()
  }

  async insertTabEvent(event: NewEvent) {
    return await this.db.insertInto('event').values(event).executeTakeFirst()
  }
}
