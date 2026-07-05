import React, { type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

interface SortableItemProps {
  id: string | number;
  children: ReactNode;
}

// Drag-and-drop reordering only applies in "Custom order" sort mode, where
// it replaces the swipe gestures used everywhere else (dragging and
// swiping the same row would fight each other) — a dedicated handle keeps
// the rest of the row's tap targets (checkbox, star, delete) unambiguous.
const SortableItem = ({ id, children }: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} sx={{ display: "flex", alignItems: "center" }}>
      <IconButton {...attributes} {...listeners} size="small" sx={{ cursor: "grab", touchAction: "none" }} aria-label="drag to reorder">
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
    </Box>
  );
};

export default SortableItem;
