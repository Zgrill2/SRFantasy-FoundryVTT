/** The system id. Must match system.json `id` and the folder name Foundry installs into. */
export const SYSTEM_NAME = 'shimmeringreach' as const;

/** Socket channel. Foundry namespaces system sockets as `system.<id>`. */
export const SYSTEM_SOCKET = `system.${SYSTEM_NAME}` as const;

/** The single flag scope all chat-card state lives under. */
export const FLAG_SCOPE = SYSTEM_NAME;

/** Root path Foundry serves the built system from. */
export const SYSTEM_PATH = `systems/${SYSTEM_NAME}` as const;

export const TEMPLATE_PATH = `${SYSTEM_PATH}/templates` as const;
export const ASSET_PATH = `${SYSTEM_PATH}/assets` as const;
