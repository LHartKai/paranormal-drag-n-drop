/**
 * Paranormal Drag & Drop
 * Enables OP2 inventory rows through ActorSheetV2's native drag/drop pipeline.
 * Foundry remains responsible for creating the standard Item drag payload and
 * receiving applications (including Item Piles) retain their own drop logic.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";
const SHEET_SELECTOR = ".op2-ficha--personagem";

/**
 * OP2 registers PersonagemSheet during init. The setup hook runs after init
 * has completed, so the system's sheet registration is available here.
 * Configure the class before normal actor-sheet instances are rendered.
 */
function configureNativeDragDrop() {
  if (game.system.id !== SYSTEM_ID) return;

  const registrations = Object.values(CONFIG.Actor.sheetClasses?.personagem ?? {});
  const sheetClass = registrations
    .map((registration) => registration.cls)
    .find((candidate) => candidate?.name === "PersonagemSheet");

  if (!sheetClass) {
    console.warn(`[${MODULE_ID}] Could not locate OP2 PersonagemSheet during setup.`);
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

  console.info(
    `[${MODULE_ID}] Configured native ActorSheetV2 drag/drop for OP2 inventory.`,
    { dragSelector: ITEM_SELECTOR, dropSelector: SHEET_SELECTOR }
  );
}

Hooks.once("ready", configureNativeDragDrop);
