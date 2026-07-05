import React, { type ReactNode } from "react";
import { useMatches, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

export interface Crumb {
  label: ReactNode;
  to?: string;
}

interface RouteHandle {
  crumbs?: (params: Record<string, string | undefined>) => Crumb[];
}

// Driven by each route's `handle.crumbs` (see router.jsx/breadcrumbConfig.tsx)
// — routes with no handle (e.g. /share-target) simply render nothing here.
// Plain inline content (not a fixed bar) — it scrolls away with the page,
// which is the normal, unremarkable way breadcrumbs behave.
const Breadcrumbs = () => {
  const matches = useMatches();
  const navigate = useNavigate();
  const match = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.crumbs);
  const crumbs = match ? (match.handle as RouteHandle).crumbs!(match.params) : null;

  if (!crumbs || crumbs.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs>
        {crumbs.map((crumb, index) =>
          crumb.to ? (
            <Link
              key={index}
              component="button"
              underline="hover"
              color="inherit"
              onClick={() => navigate(crumb.to!)}
            >
              {crumb.label}
            </Link>
          ) : (
            <Typography key={index} color="text.primary" variant="body2">
              {crumb.label}
            </Typography>
          )
        )}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs;
