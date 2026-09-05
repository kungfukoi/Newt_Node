import { useEffect, useMemo, useState } from "react";
import { historyApi } from "./api/newtApi.js";
import { createProjectOutputLoader } from "./projectOutputLoader.js";
const emptyItems = [];

export function useProjectOutputCatalog({ projectId, projectName, enabled }) {
  const [snapshot, setSnapshot] = useState(null);
  const loader = useMemo(() => {
    const instance = createProjectOutputLoader({
      list: (options) => historyApi.projectOutputs({ ...options, projectId, projectName }),
      onChange: (state) => setSnapshot({ loader: instance, ...state })
    });
    return instance;
  }, [projectId, projectName]);
  useEffect(() => { loader.activate(); return () => loader.dispose(); }, [loader]);
  useEffect(() => { if (enabled) loader.refresh(); }, [loader, enabled]);
  return { items: emptyItems, loading: false, error: "", nextCursor: "", ...(snapshot?.loader === loader ? snapshot : {}), refresh: loader.refresh, loadMore: loader.loadMore };
}
