import type { Platform } from './types'
import { tauriPlatform } from './tauriPlatform'
import { webPlatform } from './webPlatform'

const isTauri = '__TAURI_INTERNALS__' in window

export const platform: Platform = isTauri ? tauriPlatform : webPlatform
