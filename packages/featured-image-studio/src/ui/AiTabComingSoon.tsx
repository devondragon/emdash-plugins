import * as React from "react";
import { styles } from "./styles.js";

/**
 * Placeholder for v0.2 AI generation. Kept as a peer tab from day one so the
 * unified UX is visible, but clearly marked as not-yet-available. When we
 * ship v0.2 we replace this with a real provider-driven generator panel.
 */
export function AiTabComingSoon() {
  return (
    <div style={styles.empty}>
      <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>AI Generation — Coming in v0.2</h3>
      <p style={{ maxWidth: 520, margin: "0 auto 16px" }}>
        Generate featured images from a prompt using your own API key. Planned providers:
      </p>
      <ul style={{ display: "inline-block", textAlign: "left", margin: "0 auto", fontSize: 13 }}>
        <li>OpenAI Images (DALL·E / gpt-image-1) — BYOK</li>
        <li>Replicate (Flux, SDXL, more) — BYOK</li>
        <li>fal.ai — BYOK</li>
      </ul>
      <p style={{ ...styles.muted, marginTop: 16, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
        Cloudflare Workers AI is not currently reachable from distributed EmDash plugins; v0.2 will
        use HTTP-based providers with bring-your-own-key configuration.
      </p>
    </div>
  );
}
