import { workspaceNameMessages } from "app/WorkspaceManager";
import { IntlShape } from "react-intl";


/**
 * Translate built-in default tab names (Default / Tab N) for display.
 * Custom names are returned unchanged.
 */
export function formatWorkspaceDisplayName(
	name: string,
	intl: Pick<IntlShape, "formatMessage">,
): string {
	if (name === "Default") {
		return intl.formatMessage(workspaceNameMessages.defaultName);
	}
	const match = /^Tab (\d+)$/.exec(name);
	if (match) {
		return intl.formatMessage(workspaceNameMessages.tabName, {
			index: Number(match[1]),
		});
	}
	return name;
}
