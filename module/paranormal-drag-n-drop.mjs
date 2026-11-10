/**
 * Paranormal Drag & Drop
 * Enables native OP2 inventory drag/drop and transfers supported items between
 * OP2 character sheets. Player transfers are finalized by the active GM through
 * the module socket because players may not have permission to delete source items.
 * Item Piles and other drop targets retain their own transfer behavior.
 */
const MODULE_ID = "paranormal-drag-n-drop";
const SYSTEM_ID = "ordem-paranormal-2e";
const SOCKET_NAME = `module.${MODULE_ID}`;
const ITEM_SELECTOR = ".op2-lista-itens--inventario [data-item-id], .op2-lista-itens--ferramentas [data-item-id]";
const DROP_SELECTOR = ".op2-painel";
const SUPPORTED_ITEM_TYPES = new Set(["equipamento", "ferramenta"]);
const PATCHED = Symbol.for("paranormal-drag-n-drop.transfer-patch");
const PROCESSED_REQUESTS = new Set();

function isSupportedActor(actor) {
  return game.system.id === SYSTEM_ID && actor?.type === "personagem";
}

function getActiveGM() {
  return game.users.activeGM ?? game.users.filter((user) => user.isGM && user.active).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function notifyTransferResult(data) {
  if (data.targetUserId !== game.user.id) return;
  if (data.ok) {
    console.info(`[${MODULE_ID}] Transfer completed by active GM.`, data);
    return;
  }
  ui.notifications.warn(data.message ?? "O GM não conseguiu concluir a transferência. O item original foi mantido.");
  console.warn(`[${MODULE_ID}] GM transfer request failed.`, data);
}

/**
 * Runs only on the elected active GM client. All values are treated as
 * untrusted; ownership and both embedded documents are revalidated here.
 */
async function handleTransferRequest(request) {
  if (!request || request.type !== "TRANSFER_REQUEST") return;
  const activeGM = getActiveGM();
  if (!game.user.isGM || activeGM?.id !== game.user.id) return;

  const requestId = request.requestId;
  const respond = (ok, message) => game.socket.emit(SOCKET_NAME, {
    type: "TRANSFER_RESULT",
    requestId,
    targetUserId: request.requesterId,
    ok,
    message
  });

  if (!requestId || PROCESSED_REQUESTS.has(requestId)) return;
  PROCESSED_REQUESTS.add(requestId);
  if (PROCESSED_REQUESTS.size > 500) PROCESSED_REQUESTS.clear();

  try {
    const requester = game.users.get(request.requesterId);
    const sourceActor = game.actors.get(request.sourceActorId);
    const destinationActor = game.actors.get(request.destinationActorId);

    if (!requester || !requester.active || requester.isGM) {
      return respond(false, "Não foi possível validar o jogador que iniciou a transferência.");
    }
    if (!isSupportedActor(sourceActor) || !isSupportedActor(destinationActor)
      || sourceActor.id === destinationActor.id
      || !SUPPORTED_ITEM_TYPES.has(request.itemType)) {
      return respond(false, "A transferência solicitada não é válida.");
    }

    // The requester must own both character sheets. Never trust the client
    // merely because it claims to have initiated a drag operation.
    if (!sourceActor.testUserPermission(requester, "OWNER")
      || !destinationActor.testUserPermission(requester, "OWNER")) {
      return respond(false, "O jogador não tem propriedade das duas fichas.");
    }

    const sourceItem = sourceActor.items.get(request.sourceItemId);
    const destinationItem = destinationActor.items.get(request.destinationItemId);

    if (!sourceItem || !destinationItem
      || sourceItem.type !== request.itemType
      || destinationItem.type !== request.itemType
      || sourceItem.name !== destinationItem.name) {
      return respond(false, "A cópia no destino não foi confirmada. O item original foi mantido.");
    }

    await sourceItem.delete();
    console.info(`[${MODULE_ID}] Player transfer completed by active GM.`, {
      requester: requester.name,
      item: sourceItem.name,
      sourceActor: sourceActor.name,
      destinationActor: destinationActor.name
    });
    respond(true);
  } catch (error) {
    console.error(`[${MODULE_ID}] GM could not complete player transfer.`, error);
    respond(false, "O GM não conseguiu excluir o item da ficha de origem. O item original foi mantido.");
  }
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

  if (existing) existing.dropSelector = DROP_SELECTOR;
  else dragDrop.push({ dragSelector: ITEM_SELECTOR, dropSelector: DROP_SELECTOR });

  defaults.dragDrop = dragDrop;
  sheetClass.DEFAULT_OPTIONS = defaults;
  installTransferHandler(sheetClass);

  console.info(`[${MODULE_ID}] Native OP2 inventory drag/drop configured.`, {
    dragSelector: ITEM_SELECTOR,
    dropSelector: DROP_SELECTOR
  });
}

/**
 * Character-to-character drops are finalized here. GM transfers delete locally;
 * player transfers are delegated to the active GM over the module socket.
 * Other drop targets (including Item Piles) are left to their native handlers.
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

    const activeGM = getActiveGM();
    if (!game.user.isGM && !activeGM) {
      ui.notifications.warn("É necessário haver um GM conectado para transferir itens entre personagens.");
      return null;
    }

    const previousIds = new Set(this.actor.items.map((ownedItem) => ownedItem.id));
    const created = await originalOnDropItem.call(this, event, item);

    const returnedDocuments = Array.isArray(created) ? created : [created];
    let destinationItem = returnedDocuments.find((document) =>
      document?.parent?.id === this.actor.id
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

    if (game.user.isGM) {
      const sourceItem = sourceActor.items.get(item.id);
      if (!sourceItem) return created;
      await sourceItem.delete();
      console.info(`[${MODULE_ID}] GM transfer completed.`, {
        item: item.name,
        sourceActor: sourceActor.id,
        destinationActor: this.actor.id
      });
      return created ?? destinationItem;
    }

    const requestId = foundry.utils.randomID();
    game.socket.emit(SOCKET_NAME, {
      type: "TRANSFER_REQUEST",
      requestId,
      requesterId: game.user.id,
      sourceActorId: sourceActor.id,
      sourceItemId: item.id,
      destinationActorId: this.actor.id,
      destinationItemId: destinationItem.id,
      itemType: item.type
    });

    console.info(`[${MODULE_ID}] Transfer sent to active GM for source deletion.`, {
      requestId,
      item: item.name,
      sourceActor: sourceActor.id,
      destinationActor: this.actor.id,
      gm: activeGM.name
    });

    return created ?? destinationItem;
  };
}

/**
 * OP2's template uses data-item-id but does not add draggable class/attribute.
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

  game.socket.on(SOCKET_NAME, (data) => {
    if (data?.type === "TRANSFER_REQUEST") void handleTransferRequest(data);
    else if (data?.type === "TRANSFER_RESULT") notifyTransferResult(data);
  });

  configureNativeDragDrop();

  const onRender = (app, html) => {
    if (!isSupportedActor(app?.actor)) return;
    markInventoryRows(html ?? app.element);
  };

  Hooks.on("renderApplicationV2", onRender);
  Hooks.on("renderActorSheet", onRender);
  Hooks.on("renderActorSheetV2", onRender);
  document.querySelectorAll(".op2-ficha--personagem").forEach(markInventoryRows);
});
