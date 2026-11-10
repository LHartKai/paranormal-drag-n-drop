/**
 * Paranormal Drag & Drop
 * Adds native Foundry drag sources and drop targets to OP2 character inventory sheets.
 * Item Piles (or another receiver) remains responsible for transfer/trade behavior.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";
const SHEET_SELECTOR = ".op2-ficha--personagem";
const boundApps = new WeakMap();

function isSupportedActor(actor) {
  return game.system.id === SYSTEM_ID && actor?.type === "personagem";
}

function asElement(value) {
  if (value instanceof HTMLElement) return value;
  if (value?.[0] instanceof HTMLElement) return value[0];
  return null;
}

function findApp(element) {
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

  const app = findApp(row);
  if (!isSupportedActor(app?.actor)) return;

  const item = app.actor.items.get(row.dataset.itemId);
  if (!item) return;

  event.dataTransfer?.setData("text/plain", JSON.stringify(item.toDragData()));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
  row.classList.add("paranormal-drag-n-drop--dragging");
  row.addEventListener("dragend", () => row.classList.remove("paranormal-drag-n-drop--dragging"), { once: true });
}

/**
 * Bind the same drop workflow used by Foundry's ActorSheetV2. This delegates
 * document resolution and _onDropItem to the system sheet, rather than cloning
 * items ourselves or bypassing Item Piles listeners.
 */
function bindDropTarget(app) {
  if (!isSupportedActor(app?.actor)) return;
  const root = asElement(app.element);
  if (!root) return;

  const previous = boundApps.get(app);
  if (previous === root) return;

  const DragDrop = foundry.applications.ux.DragDrop;
  const handler = new DragDrop({
    dragSelector: ITEM_SELECTOR,
    dropSelector: SHEET_SELECTOR,
    permissions: {
      dragstart: () => app.isEditable,
      drop: () => true
    },
    callbacks: {
      dragstart: (event) => app._onDragStart(event),
      drop: (event) => app._onDrop(event)
    }
  });
  handler.bind(root);
  boundApps.set(app, root);
}

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`[${MODULE_ID}] Active system is "${game.system.id}", expected "${SYSTEM_ID}".`);
    return;
  }

  document.addEventListener("dragstart", onDragStart, true);

  const onRender = (app, html) => {
    if (!isSupportedActor(app?.actor)) return;
    markInventoryRows(html ?? app.element);
    bindDropTarget(app);
  };

  Hooks.on("renderApplicationV2", onRender);
  Hooks.on("renderActorSheet", onRender);
  Hooks.on("renderActorSheetV2", onRender);

  for (const app of Object.values(ui.windows)) {
    if (!isSupportedActor(app.actor)) continue;
    markInventoryRows(app.element);
    bindDropTarget(app);
  }

  console.info(`[${MODULE_ID}] Enabled OP2 inventory drag sources and sheet drop targets.`);
});
