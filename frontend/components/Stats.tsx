import React, { useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import { getStats } from "../api/stats";
import type { CountEntry, StatsOut } from "../api/types";

const SummaryCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", flex: 1 }}>
    <Typography variant="h4" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Paper>
);

const BarList = ({ entries, emptyText }: { entries: CountEntry[]; emptyText: string }) => {
  if (!entries.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {emptyText}
      </Typography>
    );
  }
  const max = Math.max(...entries.map((e) => e.count), 1);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
      {entries.map((entry) => (
        <Box key={entry.label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 110, textTransform: "capitalize" }} noWrap>
            {entry.label}
          </Typography>
          <Box sx={{ flexGrow: 1, bgcolor: "action.hover", borderRadius: 1, height: 10, overflow: "hidden" }}>
            <Box
              sx={{
                width: `${(entry.count / max) * 100}%`,
                bgcolor: "primary.main",
                height: "100%",
                borderRadius: 1,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24, textAlign: "right" }}>
            {entry.count}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const Stats = () => {
  const [stats, setStats] = useState<StatsOut | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setError("Stats need a connection — try again once you're back online."));
  }, []);

  return (
    <Box component="main" sx={{ maxWidth: 900 }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
        Stats
      </Typography>

      {error && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          {error}
        </Typography>
      )}

      {!error && !stats && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {stats && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={4}>
              <SummaryCard label="Lists" value={stats.total_lists} />
            </Grid>
            <Grid size={4}>
              <SummaryCard label="Items tracked" value={stats.total_items} />
            </Grid>
            <Grid size={4}>
              <SummaryCard label="Completion rate" value={`${stats.completion_rate}%`} />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Most purchased
            </Typography>
            <BarList entries={stats.most_purchased} emptyText="Check off some items to see your top picks here." />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              By category
            </Typography>
            <BarList entries={stats.category_breakdown} emptyText="No categorized purchases yet." />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Shopping activity (last 8 weeks)
            </Typography>
            <BarList entries={stats.activity_by_week} emptyText="No activity yet." />
          </Paper>
        </>
      )}
    </Box>
  );
};

export default Stats;
