import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

export function notFoundViewerPlugin(): PluginDescriptor {
	return {
		id: "404-viewer",
		version: "0.1.0",
		entrypoint: "@devondragon/emdash-plugin-404-viewer",
		adminEntry: "@devondragon/emdash-plugin-404-viewer/admin",
		options: {},
		capabilities: [],
		adminPages: [{ path: "/", label: "404 Log", icon: "warning" }],
		admin: {
			pages: [{ path: "/", label: "404 Log", icon: "warning" }],
		},
	};
}

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: "404-viewer",
		version: "0.1.0",
		capabilities: [],
		admin: {
			pages: [{ path: "/", label: "404 Log", icon: "warning" }],
		},
	});
}

export default createPlugin;
