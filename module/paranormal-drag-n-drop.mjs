/**
 * Paranormal Drag & Drop
 * Makes OP2 character inventory items emit the standard Foundry Item drag payload.
 * Drop behavior belongs to the receiving sheet/window/module (including Item Piles).
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
  if (!isSupportedActor(app?.actor)) return;

  const item = app.actor.items.get(row.dataset.itemId);
  if (!item) return;

  // This is the same payload format used by Foundry's native Item drag workflow.
  const payload = JSON.stringify(item.toDragData());
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.setData("application/json", payload);
    event.dataTransfer.effectAllowed = "copy";
  }

  row.classList.add("paranormal-drag-n-drop--dragging");
  row.addEventListener("dragend", () => row.classList.remove("paranormal-drag-n-drop--dragging"), { once: true });
}

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`[${MODULE_ID}] Active system is "${game.system.id}", expected "${SYSTEM_ID}".`);
    return;
  }

  // Do not attach a custom drop handler to the source sheet: every destination
  // (ActorSheet, Item Piles app, other windows) must receive the unmodified event.
  document.addEventListener("dragstart", onDragStart, true);

  const onRender = (app, html) => {
    if (isSupportedActor(app?.actor)) markInventoryRows(html ?? app.element);
  };
  Hooks.on("renderApplicationV2", onRender);
  Hooks.on("renderActorSheet", onRender);
  Hooks.on("renderActorSheetV2", onRender);

  for (const app of Object.values(ui.windows)) {
    if (isSupportedActor(app.actor)) markInventoryRows(app.element);
  }

  console.info(`[${MODULE_ID}] Native item drag sources enabled for OP2.`);
});
