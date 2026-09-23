import { Vector2 } from "app/utils/Vector2";
import { WorkspaceManager } from "app/WorkspaceManager";
import { expect } from "chai";
import DummyStorage from "./storage/DummyStorage.test";


describe("WorkspaceManager", () => {
	it("migrates legacy widgets and background", async () => {
		const storage = new DummyStorage();
		await storage.set("widgets", [
			{
				id: 1,
				type: "Notes",
				props: {},
				size: new Vector2(3, 5),
			},
		]);
		await storage.set("background", {
			mode: "Color",
			values: { color: "#112233" },
		});
		await storage.set("grid_settings", {
			fullPage: true,
			columns: 20,
			spacing: 10,
		});

		const wm = new WorkspaceManager(storage);
		await wm.load();

		expect(wm.count).to.equal(1);
		expect(wm.active.name).to.equal("Default");
		expect(wm.active.widgets).to.have.length(1);
		expect(wm.active.background.mode).to.equal("Color");
		expect(wm.active.grid_settings.columns).to.equal(20);
		expect(await storage.get("widgets")).to.be.null;
		expect(await storage.get("background")).to.be.null;
		expect(await storage.get("grid_settings")).to.be.null;
		expect(await storage.get("workspaces")).to.not.be.null;
	});

	it("hides need for switcher when count is 1", async () => {
		const storage = new DummyStorage();
		const wm = new WorkspaceManager(storage);
		await wm.load();
		expect(wm.count).to.equal(1);
	});

	it("creates and removes tabs via setTabCount", async () => {
		const storage = new DummyStorage();
		const wm = new WorkspaceManager(storage);
		await wm.load();

		wm.setTabCount(3);
		expect(wm.count).to.equal(3);
		expect(wm.state.items[1].name).to.equal("Tab 2");
		expect(wm.state.items[2].name).to.equal("Tab 3");

		wm.setActive(wm.state.items[2].id);
		wm.setTabCount(1);
		expect(wm.count).to.equal(1);
		expect(wm.state.activeId).to.equal(wm.state.items[0].id);
	});

	it("switches active workspace and keeps widgets separate", async () => {
		const storage = new DummyStorage();
		const wm = new WorkspaceManager(storage);
		await wm.load();
		wm.setTabCount(2);

		const firstId = wm.state.items[0].id;
		const secondId = wm.state.items[1].id;

		wm.updateActiveWidgets([
			{
				id: 1,
				type: "Notes",
				props: { text: "first" },
				size: new Vector2(3, 5),
				theme: {} as any,
			},
		]);
		wm.setActive(secondId);
		wm.updateActiveWidgets([
			{
				id: 1,
				type: "Clock",
				props: {},
				size: new Vector2(3, 5),
				theme: {} as any,
			},
		]);

		wm.setActive(firstId);
		expect(wm.active.widgets[0].type).to.equal("Notes");
		wm.setActive(secondId);
		expect(wm.active.widgets[0].type).to.equal("Clock");
	});

	it("renames workspaces", async () => {
		const storage = new DummyStorage();
		const wm = new WorkspaceManager(storage);
		await wm.load();
		wm.setTabCount(2);
		wm.rename(wm.state.items[0].id, "Code");
		expect(wm.state.items[0].name).to.equal("Code");
	});

	it("clamps tab count between 1 and MAX", async () => {
		const storage = new DummyStorage();
		const wm = new WorkspaceManager(storage);
		await wm.load();
		wm.setTabCount(0);
		expect(wm.count).to.equal(1);
		wm.setTabCount(99);
		expect(wm.count).to.equal(8);
	});

	it("removes a specific workspace and keeps at least one", async () => {
		const storage = new DummyStorage();
		const wm = new WorkspaceManager(storage);
		await wm.load();
		wm.setTabCount(3);

		const firstId = wm.state.items[0].id;
		const secondId = wm.state.items[1].id;
		const thirdId = wm.state.items[2].id;

		wm.setActive(secondId);
		expect(wm.remove(secondId)).to.equal(true);
		expect(wm.count).to.equal(2);
		expect(wm.state.items.map(item => item.id)).to.deep.equal([firstId, thirdId]);
		expect(wm.state.activeId).to.equal(thirdId);

		expect(wm.remove(firstId)).to.equal(true);
		expect(wm.count).to.equal(1);
		expect(wm.state.activeId).to.equal(thirdId);
		expect(wm.remove(thirdId)).to.equal(false);
		expect(wm.count).to.equal(1);
	});
});
