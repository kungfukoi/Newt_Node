// Ejection releases the canvas wait; it does not claim provider cancellation.
export function createNodeRunControl() {
  const runs = new Map();
  return {
    get: id => runs.get(id),
    ids: () => [...runs.keys()],
    async run(id, operation) {
      if (runs.has(id)) return { status: 'skipped' };
      let release;
      const stopped = new Promise(resolve => { release = resolve; });
      const token = { stopped: false, groupId: '', outputTarget: null,
        stop() { this.stopped = true; release({ status: 'error', error: new Error('Stopped at user request.') }); } };
      runs.set(id, token);
      try { return await Promise.race([Promise.resolve().then(() => operation(token)), stopped]); }
      finally { if (runs.get(id) === token) runs.delete(id); }
    },
    stop(id) { const token = runs.get(id); token?.stop(); return token; }
  };
}
export const ejectableNodeTypes = new Set(['text', 'textAgent', 'imageModel', 'videoModel', 'audioModel', 'utility', 'edit', 'assembly', 'model3d', 'output']);
