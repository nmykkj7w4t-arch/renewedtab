import React, { useEffect, useState } from "react";
import { WidgetManager } from "app/WidgetManager";
import CreateWidgetDialog from "./CreateWidgetDialog";
import WidgetGrid, { defaultGridSettings, WidgetGridSettings } from "./WidgetGrid";
import SettingsDialog from "../settings/SettingsDialog";
import Background from "../backgrounds";
import { useForceUpdate, usePromise, useStorage } from "app/hooks";
import { defineMessage, defineMessages, IntlProvider, useIntl } from "react-intl";
import { getTranslation, detectUserLocale } from "app/locale";
import { applyTheme, ThemeConfig } from "../settings/ThemeSettings";
import ReviewRequester from "./ReviewRequester";
import { storage } from "app/storage";
import * as Sentry from "@sentry/react";
import Onboarding from "../onboarding";
import { BackgroundConfig } from "app/hooks/background";
import { GlobalSearchContext } from "app/hooks/globalSearch";
import BookmarksTopBar from "./BookmarksTopBar";
import Button, { ButtonVariant } from "app/components/Button";
import { miscMessages } from "app/locale/common";
import { WidgetManagerContext } from "app/hooks/widgetManagerContext";
import { LockedContext } from "app/hooks/useIsLocked";
import { WorkspaceManager } from "app/WorkspaceManager";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { getBackgroundProvider } from "app/features/backgrounds/providers";


const messages = defineMessages({
	newTab: {
		defaultMessage: "New Tab",
	},

	unlockWidgets: {
		defaultMessage: "Enter edit mode",
		description: "Button to enter edit mode",
	},
});


function Title() {
	const intl = useIntl();

	if (typeof browser != "undefined") {
		document.title = intl.formatMessage(messages.newTab);
	}

	return null;
}


function normalizeBackground(info: BackgroundConfig): BackgroundConfig {
	const provider = getBackgroundProvider<any>(info.mode);
	return {
		mode: provider?.id ?? "Curated",
		values: {
			...(provider?.defaultValues ?? {}),
			...info.values,
		},
	};
}


const workspaceManager = new WorkspaceManager(storage);
const widgetManager = new WidgetManager(storage);
widgetManager.onSave = (widgets) => {
	workspaceManager.updateActiveWidgets(widgets);
};

export default function App() {
	const forceUpdate = useForceUpdate();
	const [loadingRes,] = usePromise(async () => {
		await workspaceManager.load();
		await widgetManager.loadFrom(workspaceManager.active.widgets);
		return true;
	}, []);

	const [query, setQuery] = useState("");
	const [locale, setLocale] = useStorage<string>("locale", detectUserLocale());
	const [showBookmarksBar, setShowBookmarksBar] = useStorage("showBookmarksBar", app_version.target == "chrome");
	const [localeMessages] = usePromise(() => locale ? getTranslation(locale) : Promise.reject(null), [locale]);
	const [background, setBackgroundState] = useState<BackgroundConfig | null>(null);
	const [theme, setTheme] = useStorage<ThemeConfig>("theme", {});
	const [createIsOpen, setCreateOpen] = useState(false);
	const [settingsIsOpen, setSettingsOpen] = useState(false);
	const [widgetsHidden, setWidgetsHidden] = useState(false);
	const [isLockedRaw, setIsLocked] = useStorage<boolean>("locked", false);
	const [switcherMouseover, setSwitcherMouseover] = useStorage<boolean>("workspaceSwitcherMouseover", false);
	const [gridSettings, setGridSettingsState] = useState<WidgetGridSettings | null>(null);
	const [onboardingIsOpen, setOnboardingIsOpen] = useState<boolean | undefined>(undefined);
	const isLocked = (isLockedRaw || onboardingIsOpen) ?? true;
	const loaded = loadingRes != null && localeMessages != null;
	const bookmarksVisible = !!(showBookmarksBar && !onboardingIsOpen && typeof browser !== "undefined");

	useEffect(() => {
		if (loaded) {
			setBackgroundState(normalizeBackground(workspaceManager.active.background));
			setGridSettingsState({
				...defaultGridSettings,
				...workspaceManager.active.grid_settings,
			});
		}
	}, [loaded]);

	useEffect(() => {
		if (loaded && onboardingIsOpen == undefined) {
			setOnboardingIsOpen(widgetManager.widgets.length == 0 && workspaceManager.count == 1);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded]);

	function setBackground(info: BackgroundConfig) {
		const normalized = normalizeBackground(info);
		workspaceManager.updateActiveBackground(normalized);
		setBackgroundState(normalized);
	}

	function setGridSettings(settings: WidgetGridSettings) {
		const next = { ...defaultGridSettings, ...settings };
		workspaceManager.updateActiveGridSettings(next);
		setGridSettingsState(next);
	}

	async function switchWorkspace(id: string) {
		if (id == workspaceManager.state.activeId) {
			return;
		}

		workspaceManager.updateActiveWidgets(widgetManager.widgets);
		workspaceManager.setActive(id);
		await widgetManager.loadFrom(workspaceManager.active.widgets);
		setBackgroundState(normalizeBackground(workspaceManager.active.background));
		setGridSettingsState({
			...defaultGridSettings,
			...workspaceManager.active.grid_settings,
		});
		forceUpdate();
	}

	async function onTabCountChange(count: number, getName?: (index: number) => string) {
		workspaceManager.updateActiveWidgets(widgetManager.widgets);
		const prevActive = workspaceManager.state.activeId;
		workspaceManager.setTabCount(count, getName);
		if (workspaceManager.state.activeId !== prevActive) {
			await widgetManager.loadFrom(workspaceManager.active.widgets);
			setBackgroundState(normalizeBackground(workspaceManager.active.background));
			setGridSettingsState({
				...defaultGridSettings,
				...workspaceManager.active.grid_settings,
			});
		}
		forceUpdate();
	}

	function onWorkspaceRename(id: string, name: string) {
		workspaceManager.rename(id, name);
		forceUpdate();
	}

	async function onWorkspaceRemove(id: string) {
		workspaceManager.updateActiveWidgets(widgetManager.widgets);
		const prevActive = workspaceManager.state.activeId;
		if (!workspaceManager.remove(id)) {
			return;
		}
		if (workspaceManager.state.activeId !== prevActive) {
			await widgetManager.loadFrom(workspaceManager.active.widgets);
			setBackgroundState(normalizeBackground(workspaceManager.active.background));
			setGridSettingsState({
				...defaultGridSettings,
				...workspaceManager.active.grid_settings,
			});
		}
		forceUpdate();
	}

	if (theme) {
		applyTheme(theme);
	}

	const classes: string[] = [];
	if (widgetsHidden) {
		classes.push("hidden");
	}

	classes.push(isLocked ? "locked" : "unlocked");

	return (
		<IntlProvider locale={(localeMessages && locale) ? locale : "en"} defaultLocale="en" messages={localeMessages ?? undefined}>
			<LockedContext.Provider value={isLocked}>
				<WidgetManagerContext.Provider value={widgetManager}>
					<GlobalSearchContext.Provider value={{ query, setQuery }}>
						<Title />
						<main className={classes.join(" ")}>
							{bookmarksVisible && (
								<BookmarksTopBar onHide={() => setShowBookmarksBar(false)} />)}
							{loaded && !onboardingIsOpen && (
								<WorkspaceSwitcher
									workspaceManager={workspaceManager}
									onSwitch={switchWorkspace}
									belowBookmarks={bookmarksVisible}
									mouseoverReveal={!!switcherMouseover} />)}
							<Sentry.ErrorBoundary fallback={<div id="background"></div>}>
								<Background background={background} setWidgetsHidden={setWidgetsHidden} />
							</Sentry.ErrorBoundary>
							{createIsOpen && (
								<CreateWidgetDialog onClose={() => setCreateOpen(false)} />)}
							{gridSettings && (
								<SettingsDialog
									isOpen={settingsIsOpen}
									onClose={() => setSettingsOpen(false)}
									background={background} setBackground={setBackground}
									theme={theme} setTheme={setTheme}
									locale={locale ?? "en"} setLocale={setLocale}
									showBookmarksBar={showBookmarksBar ?? false} setShowBookmarksBar={setShowBookmarksBar}
									grid={gridSettings} setGrid={setGridSettings}
									workspaceManager={workspaceManager}
									onTabCountChange={onTabCountChange}
									onWorkspaceRename={onWorkspaceRename}
									onWorkspaceRemove={onWorkspaceRemove}
									switcherMouseover={switcherMouseover ?? false}
									setSwitcherMouseover={setSwitcherMouseover} />)}

							{loaded && gridSettings &&
								<WidgetGrid key={workspaceManager.state.activeId}
									{...gridSettings} wm={widgetManager} isLocked={isLocked ?? false} />}
							{onboardingIsOpen && (
								<Onboarding
									onClose={() => setOnboardingIsOpen(false)}
									locale={locale ?? "en"} setLocale={setLocale} />)}
							<ReviewRequester />

							{isLocked && !onboardingIsOpen && (
								<Button id="unlock-widgets" onClick={() => setIsLocked(false)}
									tabIndex={0} variant={ButtonVariant.None}
									data-cy="start-editing"
									className="text-shadow" icon="fas fa-pen"
									title={messages.unlockWidgets} />)}

							{!isLocked && (
								<aside className="edit-bar" role="toolbar" data-cy="edit-bar">
									<Button href="https://renewedtab.com/help/"
										variant={ButtonVariant.Secondary}
										icon="fa fa-question" small={true}
										target="_blank"
										label={defineMessage({
											defaultMessage: "Help",
										})} />

									<div className="col" />

									<Button onClick={() => setCreateOpen(true)}
										variant={ButtonVariant.Secondary}
										icon="fa fa-plus" small={true}
										id="add-widget"
										label={defineMessage({
											defaultMessage: "Add Widget",
										})} />

									<Button onClick={() => setSettingsOpen(true)}
										variant={ButtonVariant.Secondary}
										icon="fa fa-cog" small={true}
										id="open-settings"
										label={defineMessage({
											defaultMessage: "Settings",
										})} />

									<Button onClick={() => setIsLocked(true)}
										variant={ButtonVariant.Secondary}
										icon="fa fa-check" small={true}
										data-cy="finish-editing"
										label={miscMessages.finishEditing} />
								</aside>)}
						</main>
					</GlobalSearchContext.Provider>
				</WidgetManagerContext.Provider>
			</LockedContext.Provider>
		</IntlProvider>);
}
