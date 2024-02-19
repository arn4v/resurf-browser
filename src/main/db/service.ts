import { createDb } from './db'
import { TabEvent } from './event_definitions'
import { NewTab, NewVisitedURL, TabUpdate } from './types'

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

  async insertTabEvent(tab_id: number, event: TabEvent) {
    return await this.db
      .insertInto('tab_event')
      .values({
        tab_id,
        event: event.type,
        data: JSON.stringify(event.data),
      })
      .executeTakeFirst()
  }
}
