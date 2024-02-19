import {
  ColumnType,
  Generated,
  SqlBool,
  JSONColumnType,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely'

export interface Database {
  tab: TabTable
  event: EventTable
  visited_url: VisitedURLTable
}

export interface TabTable {
  id: Generated<number>
  title: string
  current_url: string
  is_open: boolean
  created_at: ColumnType<Date, string | undefined, never>
}

export type Tab = Selectable<TabTable>
export type NewTab = Insertable<TabTable>
export type TabUpdate = Updateable<TabTable>

export interface EventTable {
  id: Generated<number>
  type: string
  metadata: JSONColumnType<any>
  created_at: ColumnType<Date, string | undefined, never>
}

export type Event = Selectable<EventTable>
export type NewEvent = Insertable<EventTable>

export interface VisitedURLTable {
  url: string
  title: string
  content: string
}

export type VisitedURL = Selectable<VisitedURLTable>
export type NewVisitedURL = Insertable<VisitedURLTable>
