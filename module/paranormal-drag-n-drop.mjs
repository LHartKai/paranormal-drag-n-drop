/**
 * Paranormal Drag & Drop
 * Enables native Foundry Item drag data on Ordem Paranormal 2 character inventory rows.
 * Item transfer and destination behavior remain the responsibility of the receiving module.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";

function isSupportedActor(actor) {
  return game.system.id === SYSTEM_ID && actor?.type === "personagem";
}

function asElement(value) {
  if (value instanceof HTMLElement) return value;
  if (value?.[0] instanceof HTMLElement) return value[0];
  return null;
}

function appForElement(element) {
  return Object.values(ui.windows).find((app) => {
    const root = asElement(app.element);
    return root && (root === element || root.contains(element));
  });
}

function markInventoryRows(root) {
  const element = asElement(root);
  if (!element) return;
  for (const row of element.querySelectorAll(ITEM_SELECTOR)) {
    row.setAttribute("draggable", "true");
    row.classList.add("paranormal-drag-n-drop__item");
  }
}

function onDragStart(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const row = target?.closest(ITEM_SELECTOR);
  if (!row) return;

  const app = appForElement(row);
  const actor = app?.actor;
  if (!isSupportedActor(actor)) return;

  const item = actor.items.get(row.dataset.itemId);
  if (!item) return;

  // Standard Foundry Item payload, consumed by native drop handlers and Item Piles.
  const dragData = item.toDragData();
  event.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";

  row.classList.add("paranormal-drag-n-drop--dragging");
  row.addEventListener("dragend", () => {
    row.classList.remove("paranormal-drag-n-drop--dragging");
  }, { once: true });
}

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`[${MODULE_ID}] Active system is "${game.system.id}", expected "${SYSTEM_ID}".`);
    return;
  }

  // Capture phase ensures the Item payload is present before other listeners inspect it.
  document.addEventListener("dragstart", onDragStart, true);

  // ActorSheetV2 uses the ApplicationV2 render hook. Keep the legacy hook as a
  // compatibility fallback for sheets rendered through the older application API.
  const onRender = (app, html) => {
    if (!isSupportedActor(app?.actor)) return;
    markInventoryRows(html ?? app.element);
  };
  Hooks.on("renderApplicationV2", onRender);
  Hooks.on("renderActorSheet", onRender);
  Hooks.on("renderActorSheetV2", onRender);

  // Existing windows may have rendered before this module's ready callback.
  for (const app of Object.values(ui.windows)) {
    if (isSupportedActor(app.actor)) markInventoryRows(app.element);
  }

  console.info(`[${MODULE_ID}] Enabled for OP2 character inventory rows.`);
});
