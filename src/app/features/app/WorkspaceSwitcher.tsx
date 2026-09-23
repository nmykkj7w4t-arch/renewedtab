import { Tabs } from "app/components/Tabs";
import { mergeClasses } from "app/utils";
import { WorkspaceManager } from "app/WorkspaceManager";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { formatWorkspaceDisplayName } from "./workspaceNames";


interface WorkspaceSwitcherProps {
	workspaceManager: WorkspaceManager;
	onSwitch: (id: string) => void;
	belowBookmarks?: boolean;
	mouseoverReveal?: boolean;
}


/**
 * Tab bar for switching workspaces. Hidden when only one workspace exists.
 */
export default function WorkspaceSwitcher(props: WorkspaceSwitcherProps) {
	const { workspaceManager, onSwitch, belowBookmarks, mouseoverReveal } = props;
	const intl = useIntl();
	const [hovered, setHovered] = useState(false);

	if (workspaceManager.count <= 1) {
		return null;
	}

	const options = workspaceManager.state.items.map(item => ({
		id: item.id,
		title: formatWorkspaceDisplayName(item.name, intl),
	}));

	return (
		<div
			className={mergeClasses(
				"workspace-switcher",
				belowBookmarks && "below-bookmarks",
				mouseoverReveal && "mouseover-reveal",
				mouseoverReveal && hovered && "is-hovered")}
			data-cy="workspace-switcher">
			<div className="workspace-switcher-inner"
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}>
				<Tabs
					value={workspaceManager.state.activeId}
					onChanged={onSwitch}
					options={options} />
			</div>
		</div>);
}
