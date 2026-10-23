// Keep the displayed frame while its replacement decodes. Coalesce pending
// frames so a slow viewer cannot build an ever-growing playback backlog.
export function createAssemblyFramePresenter({ present, createImage = () => new Image() }) {
  let disposed = false, pending = null, queued = "", shown = "";
  function next() {
    if (disposed || pending || !queued) return;
    const url = queued;
    queued = "";
    const image = createImage();
    pending = { image, url };
    const finish = ready => {
      if (disposed || pending?.image !== image) return;
      image.onload = image.onerror = null;
      pending = null;
      if (ready) { shown = url; present(url); }
      next();
    };
    image.onload = () => Promise.resolve().then(() => image.decode?.()).then(() => finish(true), () => finish(false));
    image.onerror = () => finish(false);
    image.src = url;
  }
  return {
    offer(url) {
      if (disposed || !url || url === pending?.url || url === queued || (!pending && url === shown)) return;
      queued = url;
      next();
    },
    dispose() {
      disposed = true;
      queued = "";
      if (pending) pending.image.onload = pending.image.onerror = null;
      pending = null;
    }
  };
}
