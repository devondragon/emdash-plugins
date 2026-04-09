import { Button, Input, Loader } from "@cloudflare/kumo";
import * as React from "react";
import {
  clearUnsplashKey,
  getKeyStatus,
  saveUnsplashKey,
  testUnsplashKey,
  type KeyStatus,
} from "./api.js";
import { styles } from "./styles.js";

type ActionState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

/**
 * Settings tab content.
 *
 * Owns the Unsplash Access Key directly: paste → Save → live status. We
 * never fetch the key value back from the server (the `unsplash/key-status`
 * route returns only `{ hasKey, hint }` where `hint` is the last four
 * characters). The input field is always blank on load — it's an *entry*
 * field, not an editor of the current value.
 *
 * Rendered inside the tabbed picker; no outer container or page heading.
 */
export function SettingsTab() {
  const [status, setStatus] = React.useState<KeyStatus | null>(null);
  const [draft, setDraft] = React.useState("");
  const [saveState, setSaveState] = React.useState<ActionState>({ kind: "idle" });
  const [testState, setTestState] = React.useState<ActionState>({ kind: "idle" });

  const refreshStatus = React.useCallback(async () => {
    try {
      setStatus(await getKeyStatus());
    } catch (e) {
      // Non-fatal — fall back to "unknown" empty state.
      setStatus({ hasKey: false, hint: null });
      // eslint-disable-next-line no-console
      console.warn("failed to load key status", e);
    }
  }, []);

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const save = async () => {
    if (!draft.trim()) return;
    setSaveState({ kind: "running" });
    try {
      await saveUnsplashKey(draft.trim());
      setDraft("");
      setSaveState({ kind: "ok", message: "Saved." });
      setTestState({ kind: "idle" });
      await refreshStatus();
    } catch (e) {
      setSaveState({ kind: "error", message: (e as Error).message });
    }
  };

  const clear = async () => {
    if (!confirm("Remove the saved Unsplash Access Key?")) return;
    setSaveState({ kind: "running" });
    try {
      await clearUnsplashKey();
      setSaveState({ kind: "ok", message: "Cleared." });
      setTestState({ kind: "idle" });
      await refreshStatus();
    } catch (e) {
      setSaveState({ kind: "error", message: (e as Error).message });
    }
  };

  const test = async () => {
    setTestState({ kind: "running" });
    try {
      await testUnsplashKey();
      setTestState({ kind: "ok", message: "✓ Key works." });
    } catch (e) {
      setTestState({ kind: "error", message: (e as Error).message });
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Unsplash Access Key</h3>
        <p style={styles.muted}>
          Get one free at{" "}
          <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer">
            unsplash.com/developers
          </a>{" "}
          — create an application, accept the terms, and copy the <strong>Access Key</strong> (not
          the Secret Key). Free "Demo" tier allows 50 requests per hour.
        </p>

        <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13 }}>
          Status:{" "}
          {status === null ? (
            <span style={styles.muted}>Loading…</span>
          ) : status.hasKey ? (
            <span style={{ color: "#059669" }}>
              ✓ Key stored{status.hint ? ` (${status.hint})` : ""}
            </span>
          ) : (
            <span style={{ color: "#dc2626" }}>No key set</span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
        >
          <Input
            type="password"
            placeholder={status?.hasKey ? "Paste a new key to replace…" : "Paste your Access Key"}
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!draft.trim() || saveState.kind === "running"}
          >
            {saveState.kind === "running" ? <Loader /> : status?.hasKey ? "Replace" : "Save"}
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <Button
            variant="outline"
            onClick={test}
            disabled={!status?.hasKey || testState.kind === "running"}
          >
            {testState.kind === "running" ? <Loader /> : "Test key"}
          </Button>
          {status?.hasKey && (
            <Button variant="outline" onClick={clear} disabled={saveState.kind === "running"}>
              Clear
            </Button>
          )}
          {saveState.kind === "ok" && (
            <span style={{ color: "#059669", fontSize: 13 }}>{saveState.message}</span>
          )}
          {saveState.kind === "error" && (
            <span style={{ color: "#dc2626", fontSize: 13 }}>✗ {saveState.message}</span>
          )}
          {testState.kind === "ok" && (
            <span style={{ color: "#059669", fontSize: 13 }}>{testState.message}</span>
          )}
          {testState.kind === "error" && (
            <span style={{ color: "#dc2626", fontSize: 13 }}>✗ {testState.message}</span>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Attribution & TOS</h3>
        <p style={styles.muted}>
          Unsplash requires that photographer credit be preserved and displayed wherever the photo
          is used. On import, this plugin automatically records the photographer's name, profile
          URL, and source URL alongside the media item. Your theme is responsible for rendering
          that attribution on the public site (planned helper in v0.2).
        </p>
        <p style={styles.muted}>
          On every actual import, this plugin also pings Unsplash's download-tracking endpoint as
          required by their{" "}
          <a
            href="https://help.unsplash.com/en/articles/2511315-guideline-triggering-a-download"
            target="_blank"
            rel="noreferrer"
          >
            API guidelines
          </a>
          .
        </p>
      </section>

      <section>
        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Editor integration</h3>
        <p style={styles.muted}>
          To use the picker directly from the post editor, attach the field widget to any image
          field in your collection schema:
        </p>
        <pre
          style={{
            background: "var(--color-bg-subtle, #f3f4f6)",
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
{`fieldWidgets: {
  featuredImage: "featured-image-studio:picker",
}`}
        </pre>
      </section>
    </div>
  );
}
