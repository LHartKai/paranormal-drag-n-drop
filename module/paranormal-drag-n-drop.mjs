/**
 * Paranormal Drag & Drop
 * Enables native OP2 inventory drag/drop and moves supported items between
 * OP2 character sheets after the destination confirms successful creation.
 * Item Piles and other drop targets retain their own transfer behavior.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";
const DROP_SELECTOR = ".op2-painel";
const SUPPORTED_ITEM_TYPES = new Set(["equipamento", "ferramenta"]);
const PATCHED = Symbol.for("paranormal-drag-n-drop.transfer-patch");

function isSupportedActor(actor) {
  return game.system.id === SYSTEM_ID && actor?.type === "personagem";
}

/**
 * OP2 registers PersonagemSheet during init. Configure the class after the
 * system has registered it, before character sheets are opened.
 */
function configureNativeDragDrop() {
  if (game.system.id !== SYSTEM_ID) return;

  const registrations = Object.values(CONFIG.Actor.sheetClasses?.personagem ?? {});
  const sheetClass = registrations
    .map((registration) => registration.cls)
    .find((candidate) => candidate?.name === "PersonagemSheet");

  if (!sheetClass) {
    console.warn(`[${MODULE_ID}] Could not locate OP2 PersonagemSheet during ready.`);
    return;
  }

  const defaults = foundry.utils.deepClone(sheetClass.DEFAULT_OPTIONS ?? {});
  const dragDrop = [...(defaults.dragDrop ?? [])];
  const existing = dragDrop.find((entry) => entry.dragSelector === ITEM_SELECTOR);

  if (existing) {
    existing.dropSelector = DROP_SELECTOR;
  } else {
    dragDrop.push({ dragSelector: ITEM_SELECTOR, dropSelector: DROP_SELECTOR });
  }

  defaults.dragDrop = dragDrop;
  sheetClass.DEFAULT_OPTIONS = defaults;

  installTransferHandler(sheetClass);

  console.info(`[${MODULE_ID}] Native OP2 inventory drag/drop configured.`, {
    dragSelector: ITEM_SELECTOR,
    dropSelector: DROP_SELECTOR
  });
}

/**
 * The standard ActorSheetV2 handler creates a new embedded Item on the
 * destination Actor. Only after that succeeds do we delete the source Item.
 * This patch is deliberately scoped to OP2 character-sheet-to-character-sheet
 * drops; Item Piles never passes through this handler.
 */
function installTransferHandler(sheetClass) {
  const prototype = sheetClass.prototype;
  if (prototype[PATCHED]) return;

  const originalOnDropItem = prototype._onDropItem;
  if (typeof originalOnDropItem !== "function") {
    console.warn(`[${MODULE_ID}] PersonagemSheet has no _onDropItem handler.`);
    return;
  }

  Object.defineProperty(prototype, PATCHED, { value: true });

  prototype._onDropItem = async function(event, item) {
    const sourceActor = item?.parent;
    const isTransfer = isSupportedActor(this.actor)
      && isSupportedActor(sourceActor)
      && sourceActor.id !== this.actor.id
      && SUPPORTED_ITEM_TYPES.has(item.type)
      && sourceActor.isOwner;

    if (!isTransfer) return originalOnDropItem.call(this, event, item);

    // Track destination documents before invoking the system/core drop handler.
    // The handler's return value is useful, but the created embedded document
    // is the authoritative confirmation that the copy arrived.
    const previousIds = new Set(this.actor.items.map((ownedItem) => ownedItem.id));
    const created = await originalOnDropItem.call(this, event, item);

    const returnedDocuments = Array.isArray(created) ? created : [created];
    let destinationItem = returnedDocuments.find((document) =>
      document?.parent?.id === this.actor.id
      // Foundry may preserve an Item ID when embedding it on another Actor.
      // The parent Actor, not the ID, distinguishes the destination document.
    );

    if (!destinationItem) {
      const newlyCreated = this.actor.items.filter((ownedItem) =>
        !previousIds.has(ownedItem.id)
        && ownedItem.type === item.type
        && ownedItem.name === item.name
      );
      if (newlyCreated.length === 1) destinationItem = newlyCreated[0];
    }

    if (!destinationItem) {
      console.warn(`[${MODULE_ID}] Destination creation was not confirmed; source item kept.`, {
        item: item.name,
        sourceActor: sourceActor.id,
        destinationActor: this.actor.id,
        handlerResult: created
      });
      return created;
    }

    const sourceItem = sourceActor.items.get(item.id);
    if (!sourceItem) {
      console.warn(`[${MODULE_ID}] Destination received item, but source item was no longer present.`, {
        item: item.name,
        sourceActor: sourceActor.id,
        destinationActor: this.actor.id
      });
      return created;
    }

    await sourceItem.delete();
    console.info(`[${MODULE_ID}] Item transfer completed.`, {
      item: item.name,
      sourceActor: sourceActor.id,
      destinationActor: this.actor.id,
      destinationItem: destinationItem.id
    });

    return created ?? destinationItem;
  };
}

/**
 * ActorSheetV2's drag controller expects draggable inventory elements. OP2's
 * template uses data-item-id but does not add the draggable class/attribute.
 */
function markInventoryRows(root) {
  const element = root instanceof HTMLElement ? root : root?.[0];
  if (!element) return;

  for (const row of element.querySelectorAll(ITEM_SELECTOR)) {
    row.classList.add("draggable");
    row.setAttribute("draggable", "true");
  }
}

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    console.warn(`[${MODULE_ID}] Active system is "${game.system.id}", expected "${SYSTEM_ID}".`);
    return;
  }

  configureNativeDragDrop();

  const onRender = (app, html) => {
    if (!isSupportedActor(app?.actor)) return;
    markInventoryRows(html ?? app.element);
  };

  Hooks.on("renderApplicationV2", onRender);
  Hooks.on("renderActorSheet", onRender);
  Hooks.on("renderActorSheetV2", onRender);

  // Also prepare sheets which were already rendered before this ready hook.
  document.querySelectorAll(".op2-ficha--personagem").forEach(markInventoryRows);
});
