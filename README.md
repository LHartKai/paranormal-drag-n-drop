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

- Enables native ActorSheetV2 drag/drop for equipment and tool inventory rows.
- Uses Foundry's own drag-start and drop handlers rather than replacing the drag payload.
- Leaves item transfer and inventory mutations to the receiving application/module.
- Does not alter OP2 system files.

## Testing checklist

1. Open an OP2 character sheet and enter the Inventory tab.
2. Drag an equipment item onto another editable OP2 character sheet.
3. Confirm the item is handled by the destination sheet's native drop pipeline.
4. Test a tool item the same way.
5. With Item Piles enabled, test dropping onto an Item Piles-compatible container/token.
6. Confirm item editing, equip toggles, charge buttons, and delete buttons still work.

## Notes

The module adds the OP2 inventory selectors to the registered `PersonagemSheet` class's `dragDrop` options during initialization. It does not install a separate drop controller or intercept drops on other applications.
