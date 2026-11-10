# Paranormal Drag & Drop

A compatibility module that connects the **equipment** and **tool** rows in Ordem Paranormal 2 (OP2) character inventories to Foundry VTT's native ActorSheetV2 drag-and-drop workflow.

It does not implement item transfers, approvals, inventory management, or piles. Receiving applications (for example, Item Piles) retain control of their own drop behavior.

## Requirements

- Foundry VTT 13 or 14
- Ordem Paranormal 2 system, module target id `ordem-paranormal-2e` (minimum version 0.10.0)
- A destination that accepts standard Foundry Item drag data

## Installation

Install from the Foundry module manifest after a release is published, or copy this repository into:

`Data/modules/paranormal-drag-n-drop`

Enable **Paranormal Drag & Drop** in Manage Modules.

## Current scope

- Registers the OP2 equipment and tool inventory selectors in `PersonagemSheet.DEFAULT_OPTIONS.dragDrop`.
- Uses Foundry's native ActorSheetV2 drag-start and drop pipeline.
- Leaves item transfer and inventory mutations to the receiving application/module.
- Does not alter OP2 system files or replace its sheet rendering and drag handlers.

## Testing checklist

1. Restart Foundry after installing or updating the module.
2. Open an OP2 character sheet and enter the Inventory tab.
3. Drag an equipment item onto another editable OP2 character sheet.
4. Confirm the item is handled by the destination sheet's native drop pipeline.
5. Test a tool item the same way.
6. With Item Piles enabled, test dropping onto an Item Piles-compatible container/token.
7. Confirm item editing, equip toggles, charge buttons, and delete buttons still work.

## Implementation notes

The module configures the registered `PersonagemSheet` class during Foundry's `setup` hook, after the OP2 system has registered its sheet during `init`. It relies on the inherited `ActorSheetV2` DragDrop controller and does not install a separate drop controller, manually create drag payloads, or intercept drops on other applications.
