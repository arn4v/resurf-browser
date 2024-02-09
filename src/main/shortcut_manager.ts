import { globalShortcut, BrowserWindow, BaseWindow } from 'electron'
import { KeyboardShortcuts } from '../shared-types/keyboard_shortcuts'

export class ShortcutManager {
	private shortcuts: Map<KeyboardShortcuts, () => void> = new Map()

	constructor(private window: BaseWindow | BrowserWindow) {
		this.window.on('focus', () => this.registerShortcuts())
		this.window.on('blur', () => this.unregisterShortcuts())
		// this.window.on("hide", () => this.unregisterShortcuts());
		// this.window.on("close", () => this.unregisterShortcuts());
		// this.window.on("closed", () => this.unregisterShortcuts());
	}

	registerShortcut(shortcut: KeyboardShortcuts, handler: () => void) {
		this.shortcuts.set(shortcut, handler)
		this.registerSingleShortcut(shortcut, handler)
	}

	private registerSingleShortcut(shortcut: KeyboardShortcuts, handler: () => void) {
		if (this.window.isFocused()) {
			globalShortcut.register(shortcut, handler)
		}
	}

	unregisterShortcuts() {
		this.shortcuts.forEach((handler, shortcut) => {
			globalShortcut.unregister(shortcut)
		})
	}

	private registerShortcuts() {
		this.shortcuts.forEach((handler, shortcut) => {
			this.registerSingleShortcut(shortcut, handler)
		})
	}
}
