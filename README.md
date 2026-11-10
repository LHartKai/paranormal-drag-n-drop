# Paranormal Drag & Drop

A small compatibility module that enables native Foundry VTT Item drag data on the **equipment** and **tool** rows in Ordem Paranormal 2 (OP2) character sheets.

It does not implement item transfers, approvals, inventory management, or piles. Those behaviors belong to the destination module/system (for example, Item Piles).

## Requirements

- Foundry VTT 13 or 14
- Ordem Paranormal 2 system (module targets system id `ordem-paranormal-2e`, version 0.11.0+)
- A destination module that accepts Foundry Item drag data, such as Item Piles

## Installation

Install from the Foundry module manifest after a release is published, or copy this repository into:

`Data/modules/paranormal-drag-n-drop`

Enable **Paranormal Drag & Drop** in Manage Modules.

## Current scope

- Makes equipment and tool inventory rows draggable in OP2 character sheets.
- Writes the standard Foundry Item drag payload (`Item.toDragData()`) to the drag data transfer.
- Leaves drop handling and all inventory mutations to the receiving application/module.
- Does not alter the OP2 system files.

## Testing checklist

1. Open an OP2 character sheet and enter the Inventory tab.
2. Confirm equipment and tool rows show a grab cursor.
3. Drag a row to a Foundry-compatible Item drop target.
4. Confirm the target receives a normal Foundry Item payload with the correct Item UUID.
5. With Item Piles enabled, test dropping onto an Item Piles-compatible container/token.
6. Confirm normal item editing, equip toggles, charge buttons, and delete buttons still work.

## Notes

The module uses delegated drag events and targets the OP2 inventory row selectors. OP2's special Occupation drop behavior is not changed. The module does not claim that Item Piles integration is fully configured; its system-specific item/quantity integration is a separate compatibility step.
