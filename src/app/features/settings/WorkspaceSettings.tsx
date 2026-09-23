import { MAX_WORKSPACES, WorkspaceManager, workspaceNameMessages } from "app/WorkspaceManager";
import { formatWorkspaceDisplayName } from "app/features/app/workspaceNames";
import React, { ChangeEvent } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";


const messages = defineMessages({
	tabCount: {
		defaultMessage: "Number of tabs",
		description: "Workspace settings: tab count",
	},

	tabCountHint: {
		defaultMessage: "Each tab is a separate start screen with its own widgets and background. With one tab, the switcher is hidden.",
		description: "Workspace settings: tab count hint",
	},

	tabName: {
		defaultMessage: "Tab {index} name",
		description: "Workspace settings: tab name label",
	},

	confirmReduceTabs: {
		defaultMessage: "Reducing the number of tabs will permanently delete the last {count, plural, one {# tab} other {# tabs}} and their widgets. Continue?",
		description: "Workspace settings: confirm reducing tabs",
	},

	confirmDeleteTab: {
		defaultMessage: "Delete tab “{name}”? Its widgets will be permanently removed.",
		description: "Workspace settings: confirm deleting a single tab",
	},

	deleteTab: {
		defaultMessage: "Delete tab",
		description: "Workspace settings: delete tab button title",
	},

	mouseover: {
		defaultMessage: "Show tabs on mouseover",
		description: "Workspace settings: mouseover reveal checkbox",
	},

	mouseoverHint: {
		defaultMessage: "When enabled, the tab switcher stays nearly invisible until you move the mouse over it.",
		description: "Workspace settings: mouseover reveal hint",
	},
});


export interface WorkspaceSettingsProps {
	workspaceManager: WorkspaceManager;
	onTabCountChange: (count: number, getName: (index: number) => string) => void;
	onWorkspaceRename: (id: string, name: string) => void;
	onWorkspaceRemove: (id: string) => void;
	switcherMouseover: boolean;
	setSwitcherMouseover: (value: boolean) => void;
}


export default function WorkspaceSettings(props: WorkspaceSettingsProps) {
	const intl = useIntl();
	const workspaces = props.workspaceManager.state.items;

	function defaultTabName(index: number) {
		if (index <= 1) {
			return intl.formatMessage(workspaceNameMessages.defaultName);
		}
		return intl.formatMessage(workspaceNameMessages.tabName, { index });
	}

	function onTabCountChanged(e: ChangeEvent<HTMLInputElement>) {
		const next = Number(e.target.value);
		if (!Number.isFinite(next)) {
			return;
		}

		const current = props.workspaceManager.count;
		const clamped = Math.max(1, Math.min(MAX_WORKSPACES, Math.floor(next)));
		if (clamped === current) {
			return;
		}

		if (clamped < current) {
			const removed = current - clamped;
			const confirmMsg = intl.formatMessage(messages.confirmReduceTabs, {
				count: removed,
			});
			if (!confirm(confirmMsg)) {
				e.target.value = String(current);
				return;
			}
		}

		props.onTabCountChange(clamped, defaultTabName);
	}

	function onDeleteTab(id: string, name: string) {
		if (workspaces.length <= 1) {
			return;
		}

		const confirmMsg = intl.formatMessage(messages.confirmDeleteTab, {
			name: formatWorkspaceDisplayName(name, intl),
		});
		if (!confirm(confirmMsg)) {
			return;
		}

		props.onWorkspaceRemove(id);
	}

	return (
		<>
			<div className="field">
				<label htmlFor="workspace-tab-count">
					<FormattedMessage {...messages.tabCount} />
				</label>
				<input id="workspace-tab-count" name="workspace-tab-count"
					type="number" min={1} max={MAX_WORKSPACES}
					value={workspaces.length}
					onChange={onTabCountChanged} />
				<p className="text-muted">
					<FormattedMessage {...messages.tabCountHint} />
				</p>
			</div>

			{workspaces.length > 1 && workspaces.map((workspace, index) => (
				<div className="field" key={workspace.id}>
					<label htmlFor={`workspace-name-${workspace.id}`}>
						<FormattedMessage {...messages.tabName} values={{ index: index + 1 }} />
					</label>
					<div className="workspace-tab-name-row">
						<input id={`workspace-name-${workspace.id}`}
							type="text" value={formatWorkspaceDisplayName(workspace.name, intl)}
							onChange={e => props.onWorkspaceRename(workspace.id, e.target.value)} />
						<button type="button" className="btn workspace-tab-delete"
							title={intl.formatMessage(messages.deleteTab)}
							aria-label={intl.formatMessage(messages.deleteTab)}
							onClick={() => onDeleteTab(workspace.id, workspace.name)}>
							<i className="fas fa-times" />
						</button>
					</div>
				</div>
			))}

			{workspaces.length > 1 && (
				<div className="field">
					<label className="inline" htmlFor="workspace-switcher-mouseover">
						<input id="workspace-switcher-mouseover" name="workspace-switcher-mouseover"
							className="mr-2" type="checkbox"
							checked={props.switcherMouseover}
							onChange={e => props.setSwitcherMouseover(e.target.checked)} />
						<FormattedMessage {...messages.mouseover} />
					</label>
					<p className="text-muted">
						<FormattedMessage {...messages.mouseoverHint} />
					</p>
				</div>
			)}
		</>);
}
