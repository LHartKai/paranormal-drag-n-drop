/**
 * Paranormal Drag & Drop
 * Connects OP2 inventory rows to ActorSheetV2's native drag/drop pipeline.
 * The native Foundry handlers create/resolve the standard Item drag payload;
 * receiving applications (including Item Piles) keep control of their drop logic.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";
const SHEET_SELECTOR = ".op2-ficha--personagem";

function isSupportedActor(actor) {
  return game.system.id === SYSTEM_ID && actor?.type === "personagem";
}

/**
 * OP2 registers PersonagemSheet during its init hook. Modules' init hooks run
 * after the system has registered its sheets, so extend that class's options
 * before any sheet instance is created.
 */
function configureNativeDragDrop() {
  if (game.system.id !== SYSTEM_ID) return;

  const registrations = Object.values(CONFIG.Actor.sheetClasses?.personagem ?? {});
  const sheetClass = registrations
    .map((registration) => registration.cls)
    .find((candidate) => candidate?.name === "PersonagemSheet");

  if (!sheetClass) {
    console.warn(`[${MODULE_ID}] Could not locate OP2 PersonagemSheet registration.`);
    return;
  }

  const defaults = foundry.utils.deepClone(sheetClass.DEFAULT_OPTIONS ?? {});
  const dragDrop = [...(defaults.dragDrop ?? [])];
  const alreadyConfigured = dragDrop.some((entry) =>
    entry.dragSelector === ITEM_SELECTOR && entry.dropSelector === SHEET_SELECTOR
  );

  if (!alreadyConfigured) {
    dragDrop.push({
      dragSelector: ITEM_SELECTOR,
      dropSelector: SHEET_SELECTOR
    });
  }

  defaults.dragDrop = dragDrop;
  sheetClass.DEFAULT_OPTIONS = defaults;

  console.info(`[${MODULE_ID}] Native ActorSheetV2 drag/drop configured for OP2 inventory.`);
}

function markInventoryRows(root) {
  const element = root instanceof HTMLElement ? root : root?.[0];
  if (!element) return;

  for (const row of element.querySelectorAll(ITEM_SELECTOR)) {
    row.setAttribute("draggable", "true");
    row.classList.add("paranormal-drag-n-drop__item");
  }
}

Hooks.once("init", configureNativeDragDrop);

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`[${MODULE_ID}] Active system is "${game.system.id}", expected "${SYSTEM_ID}".`);
    return;
  }

  const onRender = (app, html) => {
    if (!isSupportedActor(app?.actor)) return;
    markInventoryRows(html ?? app.element);
  };

  Hooks.on("renderApplicationV2", onRender);
  Hooks.on("renderActorSheet", onRender);
  Hooks.on("renderActorSheetV2", onRender);

  for (const app of Object.values(ui.windows)) {
    if (isSupportedActor(app.actor)) markInventoryRows(app.element);
  }
});
