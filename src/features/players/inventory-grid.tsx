import type { InventoryItem, PlayerInventory } from "@/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shirt, HardHat, Footprints, Shield } from "@/lib/icons";

function Slot({ item, placeholder }: { item?: InventoryItem; placeholder?: React.ReactNode }) {
  const content = (
    <div
      className={cn(
        "relative flex size-9 items-center justify-center rounded-md border border-border bg-surface text-[9px] font-medium text-muted-foreground sm:size-10",
        item && "border-border/80 bg-surface-elevated",
      )}
    >
      {item ? (
        <>
          <span
            className={cn(
              "line-clamp-2 px-0.5 text-center leading-tight text-foreground",
              item.enchanted && "text-status-info",
            )}
          >
            {item.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
          {item.count > 1 && (
            <span className="absolute bottom-0 right-0.5 text-[9px] font-semibold text-foreground">
              {item.count}
            </span>
          )}
        </>
      ) : (
        placeholder
      )}
    </div>
  );

  if (!item) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        {item.name} {item.count > 1 && `x${item.count}`} {item.enchanted && "(Enchanted)"}
      </TooltipContent>
    </Tooltip>
  );
}

export function InventoryGrid({ inventory }: { inventory: PlayerInventory }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <Slot item={inventory.helmet} placeholder={<HardHat className="size-4 opacity-30" />} />
        <Slot item={inventory.chestplate} placeholder={<Shirt className="size-4 opacity-30" />} />
        <Slot item={inventory.leggings} placeholder={<Shirt className="size-4 opacity-30" />} />
        <Slot item={inventory.boots} placeholder={<Footprints className="size-4 opacity-30" />} />
        <div className="mx-1 w-px self-stretch bg-border" />
        <Slot item={inventory.offhand} placeholder={<Shield className="size-4 opacity-30" />} />
      </div>

      <div className="grid grid-cols-9 gap-1.5">
        {inventory.main.map((item, i) => (
          <Slot key={i} item={item} />
        ))}
      </div>

      <div className="grid grid-cols-9 gap-1.5 border-t border-dashed border-border pt-3">
        {inventory.hotbar.map((item, i) => (
          <Slot key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
