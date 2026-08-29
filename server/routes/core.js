export function registerCoreRoutes(
  app,
  {
    safeRelativeAssetPath,
    resolveLocalAssetPath,
    workflowPackagePublicPath,
    selectFolderWithDialog,
    selectLoraFileWithDialog,
    selectSavePathWithDialog,
    selectWorkflowFileWithDialog,
    readWorkflowFromFilePath,
    saveWorkflowToFilePath,
    readWorkflowFromPath,
    buildHealthPayload,
    openProjectOutputFolder,
    resolveProjectOutputPath,
    timedApi,
    buildStorageDiagnostics,
    readRuntimeSettings,
    saveRuntimeSettings,
    validateRuntimeApiKeys,
    pullRuntimeUpdate,
    requestServerRestart,
    readComfyWanStatus,
    readMinimaxH3LocalStatus
  }
) {
  app.get(/^\/workflow-assets\/([^/]+)\/(.+)$/, async (req, res) => {
    try {
      const workflowId = decodeURIComponent(req.params[0] || "");
      const relativePath = safeRelativeAssetPath(decodeURIComponent(req.params[1] || ""));
      if (!workflowId || !relativePath) return res.status(400).send("Invalid workflow asset path.");

      const { filePath } = await resolveLocalAssetPath(workflowPackagePublicPath(workflowId, relativePath));
      res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) res.status(error.statusCode || 404).send("Workflow asset not found.");
      });
    } catch (error) {
      if (!res.headersSent) res.status(400).send(error.message || "Invalid workflow asset path.");
    }
  });

  app.post("/api/system/select-folder", async (req, res) => {
    try {
      const selectedPath = await selectFolderWithDialog({
        title: String(req.body.title || "Choose folder"),
        defaultPath: String(req.body.defaultPath || "")
      });
      res.json({ path: selectedPath });
    } catch (error) {
      const status = error.code === "DIALOG_CANCELED" ? 499 : 500;
      res.status(status).json({ error: error.message || "Folder selection failed.", canceled: error.code === "DIALOG_CANCELED" });
    }
  });

  app.post("/api/system/select-lora-file", async (req, res) => {
    try {
      const selectedPath = await selectLoraFileWithDialog({
        title: String(req.body.title || "Choose LoRA file"),
        defaultPath: String(req.body.defaultPath || "")
      });
      res.json({ path: selectedPath });
    } catch (error) {
      const status = error.code === "DIALOG_CANCELED" ? 499 : 500;
      res.status(status).json({ error: error.message || "LoRA file selection failed.", canceled: error.code === "DIALOG_CANCELED" });
    }
  });

  app.post("/api/system/select-save-path", async (req, res) => {
    try {
      const selectedPath = await selectSavePathWithDialog({
        title: String(req.body.title || "Save export"),
        defaultPath: String(req.body.defaultPath || ""),
        defaultName: String(req.body.defaultName || "export"),
        extension: String(req.body.extension || "")
      });
      res.json({ path: selectedPath });
    } catch (error) {
      const status = error.code === "DIALOG_CANCELED" ? 499 : 500;
      res.status(status).json({ error: error.message || "Save selection failed.", canceled: error.code === "DIALOG_CANCELED" });
    }
  });

  app.post("/api/system/open-workflow-file", async (req, res) => {
    try {
      const useFolderPicker = req.body.mode === "folder";
      const selectedPath = useFolderPicker
        ? await selectFolderWithDialog({
          title: String(req.body.title || "Open NewtNode workflow package folder"),
          defaultPath: String(req.body.defaultPath || "")
        })
        : await selectWorkflowFileWithDialog({
          title: String(req.body.title || "Open NewtNode workflow"),
          defaultPath: String(req.body.defaultPath || "")
        });
      const workflow = await (readWorkflowFromPath || readWorkflowFromFilePath)(selectedPath);
      res.json(workflow);
    } catch (error) {
      const status = error.code === "DIALOG_CANCELED" ? 499 : 500;
      res.status(status).json({ error: error.message || "Workflow selection failed.", canceled: error.code === "DIALOG_CANCELED" });
    }
  });

  app.post("/api/system/save-workflow-file", async (req, res) => {
    try {
      const workflow = await saveWorkflowToFilePath(req.body.filePath, req.body.workflow || req.body);
      res.json(workflow);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "Workflow save failed." });
    }
  });

  app.post("/api/system/open-project-output-folder", async (req, res) => {
    try {
      if (!openProjectOutputFolder) throw new Error("Opening output folders is not available.");
      res.json(await openProjectOutputFolder(req.body || {}));
    } catch (error) {
      res.status(500).json({ error: error.message || "Could not open output folder." });
    }
  });

  app.post("/api/system/project-output-path", async (req, res) => {
    try {
      if (!resolveProjectOutputPath) throw new Error("Resolving the project output path is not available.");
      res.json(await resolveProjectOutputPath(req.body || {}));
    } catch (error) {
      res.status(500).json({ error: error.message || "Could not resolve the project output path." });
    }
  });

  app.get("/api/system/control-health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/health", (_req, res) => {
    res.json(buildHealthPayload());
  });

  app.get("/api/comfy-wan/status", async (req, res) => {
    await timedApi("comfy-wan:status", async () => {
      res.json(await readComfyWanStatus({
        workflow: String(req.query.workflow || ""),
        rootPath: String(req.query.rootPath || "")
      }));
    });
  });

  app.get("/api/minimax-h3-local/status", async (_req, res) => {
    await timedApi("minimax-h3-local:status", async () => {
      res.json(await readMinimaxH3LocalStatus());
    });
  });

  app.get("/api/settings", async (req, res) => {
    await timedApi("settings:read", async () => {
      res.json(await readRuntimeSettings({
        includeSecrets: ["1", "true", "yes"].includes(String(req.query.includeSecrets || "").toLowerCase())
      }));
    });
  });

  app.post("/api/settings", async (req, res) => {
    await timedApi("settings:save", async () => {
      res.json(await saveRuntimeSettings(req.body || {}));
    });
  });

  app.post("/api/settings/validate-keys", async (_req, res) => {
    await timedApi("settings:validate-keys", async () => {
      res.json(await validateRuntimeApiKeys());
    });
  });

  app.post("/api/settings/update", async (req, res) => {
    await timedApi("settings:update", async () => {
      res.json(await pullRuntimeUpdate(req.body || {}));
    });
  });

  app.post("/api/settings/restart", async (_req, res) => {
    await timedApi("settings:restart", async () => {
      res.json(await requestServerRestart());
    });
  });

  app.get("/api/storage/diagnostics", async (_req, res) => {
    await timedApi("storage:diagnostics", async () => {
      res.json(await buildStorageDiagnostics());
    });
  });
}
