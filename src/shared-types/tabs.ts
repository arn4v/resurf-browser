export interface Tab {
	id: string
	parent?: string
	favicon?: string
	title: string
	url: string
}

export type TabsMap = Record<string, Tab>
