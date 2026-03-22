export function createWorkspaceSettingsRuntime({
  getShouldersDir,
  getGlobalConfigDir,
  getProjectDir,
  getInstructionsPaths,
  getApiKeys,
  getModelsConfig,
  getDisabledTools,
  setSystemPrompt,
  setInstructions,
  setApiKeys,
  setApiKey,
  setModelsConfig,
  setAiRuntime,
  setDisabledTools,
  setSkillsManifest,
  loadSystemPrompt,
  loadWorkspaceInstructions,
  migrateWorkspaceInstructionsFile,
  resolveInstructionsFileToOpen,
  loadWorkspaceGlobalKeys,
  saveWorkspaceGlobalKeys,
  loadWorkspaceModelsConfig,
  saveWorkspaceModelsConfig,
  loadAiRuntimeConfig,
  loadWorkspaceToolPermissions,
  saveWorkspaceToolPermissions,
  loadWorkspaceSkillsManifest,
  migrateWorkspaceEnvKeys,
  syncWorkspaceProviderModels,
  getDefaultModelsConfig,
  openWorkspaceFileInEditor,
  onInstructionsMigrationError,
} = {}) {
  async function migrateAutoInstructionsFile() {
    const { rootPath, internalPath } = getInstructionsPaths?.() || {}
    if (!rootPath || !internalPath) return

    try {
      await migrateWorkspaceInstructionsFile?.({
        rootPath,
        internalPath,
      })
    } catch (error) {
      onInstructionsMigrationError?.(error)
    }
  }

  async function loadInstructions() {
    const instructions = await loadWorkspaceInstructions?.(getInstructionsPaths?.())
    setInstructions?.(instructions)
    return instructions
  }

  async function openInstructionsFile() {
    const filePath = await resolveInstructionsFileToOpen?.(getInstructionsPaths?.())
    if (!filePath) return null

    openWorkspaceFileInEditor?.(filePath)
    return filePath
  }

  async function loadGlobalKeys() {
    return loadWorkspaceGlobalKeys?.(getGlobalConfigDir?.())
  }

  async function saveGlobalKeys(keys) {
    await saveWorkspaceGlobalKeys?.(getGlobalConfigDir?.(), keys)
  }

  async function loadToolPermissions() {
    const disabledTools = await loadWorkspaceToolPermissions?.({
      globalConfigDir: getGlobalConfigDir?.(),
      shouldersDir: getShouldersDir?.(),
    })
    setDisabledTools?.(disabledTools)
    return disabledTools
  }

  async function saveToolPermissions() {
    await saveWorkspaceToolPermissions?.({
      globalConfigDir: getGlobalConfigDir?.(),
      disabledTools: getDisabledTools?.(),
    })
  }

  async function loadSkillsManifest() {
    const skillsManifest = await loadWorkspaceSkillsManifest?.(getProjectDir?.())
    setSkillsManifest?.(skillsManifest)
    return skillsManifest
  }

  async function loadSettings() {
    const shouldersDir = getShouldersDir?.()
    if (!shouldersDir) return null

    setSystemPrompt?.(await loadSystemPrompt?.(shouldersDir))
    await loadInstructions()

    let apiKeys = await loadGlobalKeys()
    if (Object.keys(apiKeys || {}).length === 0) {
      const workspaceKeys = await migrateWorkspaceEnvKeys?.({
        shouldersDir,
        globalConfigDir: getGlobalConfigDir?.(),
      })
      if (Object.keys(workspaceKeys || {}).length > 0) {
        apiKeys = workspaceKeys
      }
    }

    setApiKeys?.(apiKeys || {})
    setApiKey?.(apiKeys?.ANTHROPIC_API_KEY || '')

    const modelsConfig = await loadWorkspaceModelsConfig?.({
      globalConfigDir: getGlobalConfigDir?.(),
      shouldersDir,
    })
    setModelsConfig?.(modelsConfig)
    setAiRuntime?.(await loadAiRuntimeConfig?.(getGlobalConfigDir?.()))
    await loadToolPermissions()
    await loadSkillsManifest()

    return {
      apiKeys: apiKeys || {},
      modelsConfig,
    }
  }

  async function saveModelsConfig(config) {
    const normalized = await saveWorkspaceModelsConfig?.({
      globalConfigDir: getGlobalConfigDir?.(),
      shouldersDir: getShouldersDir?.(),
      config,
    })
    setModelsConfig?.(normalized)
    return normalized
  }

  async function syncProviderModels({ providerIds = null } = {}) {
    if (!getModelsConfig?.()) {
      await loadSettings()
    }

    const result = await syncWorkspaceProviderModels?.({
      globalConfigDir: getGlobalConfigDir?.(),
      shouldersDir: getShouldersDir?.(),
      modelsConfig: getModelsConfig?.() || getDefaultModelsConfig?.(),
      apiKeys: getApiKeys?.(),
      providerIds,
    })
    setModelsConfig?.(result?.config)
    return {
      addedCount: result?.addedCount,
      syncedProviders: result?.syncedProviders,
      failedProviders: result?.failedProviders,
    }
  }

  return {
    loadSettings,
    loadSkillsManifest,
    loadGlobalKeys,
    saveGlobalKeys,
    saveModelsConfig,
    syncProviderModels,
    migrateAutoInstructionsFile,
    loadInstructions,
    openInstructionsFile,
    loadToolPermissions,
    saveToolPermissions,
  }
}
