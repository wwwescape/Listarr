import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import db, { type EntityId } from "../db";
import * as sync from "../sync";
import { parseQuickAdd } from "../utils/quickAdd";

// manifest.json's share_target sends the OS share sheet here as
// /share-target?title=&text=&url= — pick a list and the shared content
// becomes a quick-added item (through the same parser as manual quick-add,
// so "share text: 2kg potatoes" still splits into qty/unit/name).
const ShareTarget = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lists = useLiveQuery(() => db.lists.toArray());

  const sharedText = searchParams.get("text") || searchParams.get("title") || searchParams.get("url") || "";

  useEffect(() => {
    sync.hydrateLists();
  }, []);

  const handlePick = async (listId: EntityId) => {
    const parsed = parseQuickAdd(sharedText);
    if (parsed.name) {
      await sync.createListItem(listId, {
        item_id: null,
        name: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        notes: "",
        category_id: null,
        area_id: null,
        priority: "normal",
        brand: "",
        favourite: false,
      });
    }
    navigate(`/list/${listId}`);
  };

  return (
    <Container component="main" maxWidth="md">
      <Typography component="h1" variant="h5" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
        Add to a list
      </Typography>
      {sharedText && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          &quot;{sharedText}&quot;
        </Typography>
      )}
      {!lists ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <List>
          {lists.map((list) => (
            <ListItemButton key={list.id} onClick={() => handlePick(list.id)}>
              <ListItemText primary={list.name} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Container>
  );
};

export default ShareTarget;
