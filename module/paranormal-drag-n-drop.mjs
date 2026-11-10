/**
 * Paranormal Drag & Drop
 * Enables native Foundry Item drag data on Ordem Paranormal 2 character inventory rows.
 *
 * This module deliberately does not transfer or mutate Items. Destination handling
 * (including Item Piles) remains responsible for interpreting the dropped Item.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";
const SHEET_SELECTOR = ".op2-ficha--personagem";

function isSupportedActor(actor) {
  return actor?.type === "personagem" && actor?.system && game.system.id === SYSTEM_ID;
}

function getItemFromRow(row, actor) {
  const itemId = row?.dataset?.itemId;
  return itemId ? actor.items.get(itemId) ?? null : null;
}

function onDragStart(event) {
  const row = event.target.closest(ITEM_SELECTOR);
  if (!row) return;

  const sheet = row.closest(SHEET_SELECTOR);
  const appId = sheet?.dataset?.applicationId;
  const app = appId ? Object.values(ui.windows).find((window) => String(window.appId) === String(appId)) : null;
  const actor = app?.actor;
  if (!isSupportedActor(actor)) return;

  const item = getItemFromRow(row, actor);
  if (!item) return;

  // Foundry's standard Item drag payload is what Item Piles and other drop targets
  // expect. Use the document's own dragData implementation rather than rebuilding it.
  const dragData = item.toDragData();
  event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = "copyMove";
  row.classList.add("paranormal-drag-n-drop--dragging");

  const cleanup = () => row.classList.remove("paranormal-drag-n-drop--dragging");
  row.addEventListener("dragend", cleanup, { once: true });
}

function markInventoryRows(root) {
  if (!root?.querySelectorAll) return;
  for (const row of root.querySelectorAll(ITEM_SELECTOR)) {
    // Do not override existing behavior if Foundry or another module already marked it.
    if (!row.hasAttribute("draggable")) row.setAttribute("draggable", "true");
    row.classList.add("paranormal-drag-n-drop__item");
  }
}

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`[${MODULE_ID}] Active system is "${game.system.id}", expected "${SYSTEM_ID}". Module inactive.`);
    return;
  }

  // Delegated listener survives ActorSheetV2 rerenders and covers sheets opened later.
  document.addEventListener("dragstart", onDragStart, true);
  Hooks.on("renderActorSheet", (app, html) => {
    if (!isSupportedActor(app.actor)) return;
    markInventoryRows(html instanceof HTMLElement ? html : html?.[0] ?? app.element);
  });

  // Also handle sheets that were already rendered before ready.
  for (const app of Object.values(ui.windows)) {
    if (isSupportedActor(app.actor)) markInventoryRows(app.element);
  }

  console.info(`[${MODULE_ID}] Drag & Drop enabled for OP2 character inventories.`);
});
