export function startWindowLifecycle({ browser = window, connect } = {}) {
  let connection;
  const open = () => { if (!connection) connection = connect(); };
  const close = () => { connection?.close(); connection = null; };
  browser.addEventListener("pagehide", close);
  browser.addEventListener("pageshow", open);
  open();
  return () => {
    close();
    browser.removeEventListener("pagehide", close);
    browser.removeEventListener("pageshow", open);
  };
}
