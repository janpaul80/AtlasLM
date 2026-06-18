/**
 * Patch 016B - AtlasLM mobile model layer.
 * Place at: android-shell/src/models/atlas-model-router.ts
 *
 * One clean, modular contract for every way AtlasLM can run a model.
 * The mobile UI never talks to a provider directly. It calls the router,
 * which picks a backend based on user settings. This is the integration
 * point the brief asked for: BYOK, local models, and Pro models, behind a
 * single stable interface so future modules plug in without UI changes.
 */

export type ModelMode = "byok" | "local" | "pro";

export interface ModelProfile {
  id: string;            // stable id, e.g. "byok:openai", "local:llama3", "pro:atlas-large"
  mode: ModelMode;
  label: string;         // shown in the UI, human copy only
  contextTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
}

export interface GenerateRequest {
  profileId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ModelBackend {
  /** Profiles this backend can serve, given current credentials/state. */
  listProfiles(): Promise<ModelProfile[]>;
  /** Run a generation. Implementations stream when request.stream is true. */
  generate(req: GenerateRequest): AsyncIterable<string>;
}

/**
 * BYOK: the user supplies their own key, stored on-device only via
 * Capacitor Preferences. The key never leaves the device except in the
 * direct call to the user's chosen provider.
 */
export interface ByokBackend extends ModelBackend {
  setKey(provider: string, key: string): Promise<void>;
  clearKey(provider: string): Promise<void>;
}

/**
 * Local: on-device or LAN model. Stubbed contract so a future module
 * (for example a bundled small model or an Ollama endpoint on the user's
 * machine) drops in without touching the UI.
 */
export interface LocalBackend extends ModelBackend {
  endpoint(): Promise<string | null>;  // null when no local runtime is reachable
}

/**
 * Pro: AtlasLM-hosted models on atlaslm.cloud. Auth is the user's AtlasLM
 * session, billed by plan. No keys live on-device for this path.
 */
export interface ProBackend extends ModelBackend {
  baseUrl: string; // "https://atlaslm.cloud/api/v1/models"
}

/** The router the mobile app actually imports. */
export class AtlasModelRouter {
  constructor(
    private backends: Record<ModelMode, ModelBackend>,
  ) {}

  async profiles(): Promise<ModelProfile[]> {
    const all = await Promise.all(
      Object.values(this.backends).map((b) => b.listProfiles().catch(() => [])),
    );
    return all.flat();
  }

  generate(req: GenerateRequest): AsyncIterable<string> {
    const mode = req.profileId.split(":")[0] as ModelMode;
    const backend = this.backends[mode];
    if (!backend) {
      throw new Error(`No backend registered for mode "${mode}".`);
    }
    return backend.generate(req);
  }
}
