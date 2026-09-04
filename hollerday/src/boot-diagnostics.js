(() => {
  function textOf(value) {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (value && typeof value === "object" && "message" in value) return String(value.message);
    return String(value || "Unknown startup error");
  }

  function report(value, source = "runtime") {
    const message = textOf(value).slice(0, 500);
    document.documentElement.dataset.hollerdayBootError = `${source}: ${message}`;
    const status = document.querySelector("#homeStatus") || document.querySelector("#connectionState");
    if (status) status.textContent = `Startup error: ${message}`;
    console.error("Hollerday startup error", source, value);
  }

  window.addEventListener("error", event => {
    // Ignore ordinary resource-load errors; report actual JavaScript exceptions.
    if (!event.message && !event.error) return;
    report(event.error || event.message, event.filename ? `${event.filename}:${event.lineno || 0}` : "runtime");
  });

  window.addEventListener("unhandledrejection", event => {
    report(event.reason, "promise");
  });

  window.HollerdayBootDiagnostics = { report };
})();
