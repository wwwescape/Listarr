import React, { useState, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import Box from "@mui/material/Box";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

interface SwipeableItemProps {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  disableRight?: boolean;
  disableLeft?: boolean;
}

// Swipe right to check/uncheck, swipe left to delete — matches the common
// mobile shopping/todo-list pattern. Falls back to no-op if the caller
// doesn't want an action in a given direction (disabled).
const SwipeableItem = ({ children, onSwipeRight, onSwipeLeft, disableRight, disableLeft }: SwipeableItemProps) => {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (e) => {
      const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, e.deltaX));
      if (clamped > 0 && disableRight) return;
      if (clamped < 0 && disableLeft) return;
      setSwiping(true);
      setOffset(clamped);
    },
    onSwiped: (e) => {
      setSwiping(false);
      if (e.deltaX > SWIPE_THRESHOLD && !disableRight) {
        onSwipeRight?.();
      } else if (e.deltaX < -SWIPE_THRESHOLD && !disableLeft) {
        onSwipeLeft?.();
      }
      setOffset(0);
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const showRight = offset > 16;
  const showLeft = offset < -16;

  return (
    <Box sx={{ position: "relative", overflow: "hidden", borderRadius: 2, mb: 0.5 }}>
      {(showRight || showLeft) && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: showRight ? "flex-start" : "flex-end",
            px: 3,
            bgcolor: showRight ? "success.main" : "error.main",
          }}
        >
          {showRight ? (
            <CheckCircleIcon sx={{ color: "white" }} />
          ) : (
            <DeleteIcon sx={{ color: "white" }} />
          )}
        </Box>
      )}
      <Box
        {...handlers}
        sx={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? "none" : "transform 0.2s ease",
          bgcolor: "background.paper",
          position: "relative",
          touchAction: "pan-y",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default SwipeableItem;
