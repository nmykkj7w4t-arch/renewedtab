import { BackgroundConfig } from "app/hooks/background";
import type { WidgetGridSettings } from "app/features/app/WidgetGrid";
import { IStorage } from "app/storage";
import deepCopy from "app/utils/deepcopy";
import uuid from "app/utils/uuid";
import { Widget } from "app/Widget";
import { defineMessages } from "react-intl";


export const MAX_WORKSPACES = 8;

export const workspaceNameMessages = defineMessages({
	defaultName: {
		defaultMessage: "Default",
		description: "Default name for the first workspace tab",
	},

	tabName: {
		defaultMessage: "Tab {index}",
		description: "Default name for a newly created workspace tab",
	},
});


const defaultGridSettings: WidgetGridSettings = {
	fullPage: false,
	columns: 15,
	spacing: 15,
};


export interface Workspace {
	id: string;
	name: string;
	widgets: Widget<unknown>[];
	background: BackgroundConfig;
	grid_settings: WidgetGridSettings;
}


export interface WorkspacesState {
	activeId: string;
	items: Workspace[];
}


function defaultBackground(): BackgroundConfig {
	return {
		mode: "Curated",
		values: {},
	};
}


function normalizeBackground(info: BackgroundConfig | null | undefined): BackgroundConfig {
	if (info?.mode) {
		return {
			mode: info.mode,
			values: { ...(info.values ?? {}) },
		};
	}
	return defaultBackground();
}


function createWorkspace(name: string, partial?: Partial<Omit<Workspace, "name">> & { name?: string }): Workspace {
	return {
		id: uuid(),
		name,
		widgets: [],
		background: defaultBackground(),
		grid_settings: { ...defaultGridSettings },
		...partial,
	};
}


function englishFallbackName(index: number): string {
	return index <= 1 ? "Default" : `Tab ${index}`;
}


/**
 * Manages multiple start-screen workspaces (tabs).
 * Style is global via Theme settings; each tab only stores widgets/background/grid.
 */
export class WorkspaceManager {
	state: WorkspacesState = {
		activeId: "",
		items: [],
	};

	constructor(private storage: IStorage) {}

	get active(): Workspace {
		const found = this.state.items.find(item => item.id == this.state.activeId);
		return found ?? this.state.items[0];
	}

	get count(): number {
		return this.state.items.length;
	}

	async load() {
		const existing = await this.storage.get<WorkspacesState>("workspaces");
		if (existing?.items?.length) {
			this.state = {
				activeId: existing.activeId,
				items: existing.items.map(item => ({
					id: item.id,
					name: item.name,
					background: normalizeBackground(item.background),
					grid_settings: { ...defaultGridSettings, ...item.grid_settings },
					widgets: item.widgets ?? [],
				})),
			};
			if (!this.state.items.some(item => item.id == this.state.activeId)) {
				this.state.activeId = this.state.items[0].id;
			}
			return;
		}

		await this.migrateFromLegacy();
	}

	private async migrateFromLegacy() {
		const widgets = await this.storage.get<Widget<unknown>[]>("widgets") ?? [];
		const background = normalizeBackground(
			await this.storage.get<BackgroundConfig>("background"));
		const grid_settings = {
			...defaultGridSettings,
			...(await this.storage.get<WidgetGridSettings>("grid_settings") ?? {}),
		};

		const workspace = createWorkspace(englishFallbackName(1), {
			widgets,
			background,
			grid_settings,
		});

		this.state = {
			activeId: workspace.id,
			items: [workspace],
		};
		await this.save();

		await this.storage.remove("widgets");
		await this.storage.remove("background");
		await this.storage.remove("grid_settings");
	}

	async save() {
		await this.storage.set("workspaces", this.state);
	}

	updateActiveWidgets(widgets: Widget<unknown>[]) {
		this.active.widgets = widgets;
		this.save();
	}

	updateActiveBackground(background: BackgroundConfig) {
		this.active.background = normalizeBackground(background);
		this.save();
	}

	updateActiveGridSettings(grid_settings: WidgetGridSettings) {
		this.active.grid_settings = { ...defaultGridSettings, ...grid_settings };
		this.save();
	}

	setActive(id: string) {
		if (!this.state.items.some(item => item.id == id)) {
			return;
		}
		this.state.activeId = id;
		this.save();
	}

	rename(id: string, name: string) {
		const workspace = this.state.items.find(item => item.id == id);
		if (!workspace) {
			return;
		}
		workspace.name = name.trim() || workspace.name;
		this.save();
	}

	/**
	 * Removes a workspace by id. Keeps at least one workspace.
	 * @returns true if a workspace was removed
	 */
	remove(id: string): boolean {
		if (this.state.items.length <= 1) {
			return false;
		}

		const index = this.state.items.findIndex(item => item.id == id);
		if (index < 0) {
			return false;
		}

		const wasActive = this.state.activeId == id;
		this.state.items.splice(index, 1);
		if (wasActive) {
			this.state.activeId = this.state.items[Math.min(index, this.state.items.length - 1)].id;
		}
		this.save();
		return true;
	}

	/**
	 * @param getName Optional. Receives 1-based tab index for newly created tabs.
	 */
	setTabCount(count: number, getName?: (index: number) => string) {
		const target = Math.max(1, Math.min(MAX_WORKSPACES, Math.floor(count)));
		const items = this.state.items;
		const nameFor = getName ?? englishFallbackName;

		while (items.length < target) {
			items.push(createWorkspace(nameFor(items.length + 1), {
				background: deepCopy(this.active.background),
				grid_settings: deepCopy(this.active.grid_settings),
			}));
		}

		if (items.length > target) {
			const removed = items.splice(target);
			if (removed.some(item => item.id == this.state.activeId)) {
				this.state.activeId = items[0].id;
			}
		}

		this.save();
	}
}
