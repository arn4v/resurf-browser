export interface Tab {
  id: string
  parent?: string
  title: string
  url: string
  favicon?: string
  children: string[]
}

export type TabsMap = Record<string, Tab>

export interface TabStateInterface {
  findInPage: {
    visible: boolean
    query: string
    results_cursor: number
    results_total: number
  }
}

export class TabState implements TabStateInterface {
  public findInPage: {
    visible: boolean
    query: string
    results_cursor: number
    results_total: number
  } = FIND_IN_PAGE_INITIAL_STATE
}

export const FIND_IN_PAGE_INITIAL_STATE: TabStateInterface['findInPage'] = {
  visible: false,
  query: '',
  results_cursor: 0,
  results_total: 0,
}

export enum TabCloseBehavior {
  Cascade = 'cascade',
  Elevate = 'elevate',
}
