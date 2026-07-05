import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Button from "@mui/material/Button";
import type { EntityId, HomeRow } from "../db";
import type { UserOut } from "../api/types";

export interface ListFormValues {
  name: string;
  collaborators: EntityId[];
  home_id: EntityId | null;
}

interface ListFormDialogProps {
  open: boolean;
  mode: "add" | "edit";
  initialValues: ListFormValues;
  allCollaborators: UserOut[];
  assignableHomes: HomeRow[];
  onClose: () => void;
  onSubmit: (values: ListFormValues) => Promise<void> | void;
}

// Shared by Lists.tsx's "New List" flow and List.tsx's "Edit" flow — kept as
// one component specifically so the two are guaranteed to stay "the same
// popup", not just similar. Collaborators is a real multi-select (a list can
// have any number of them), unlike the single-value Home select below it.
const ListFormDialog = ({
  open,
  mode,
  initialValues,
  allCollaborators,
  assignableHomes,
  onClose,
  onSubmit,
}: ListFormDialogProps) => {
  const [name, setName] = useState(initialValues.name);
  const [collaborators, setCollaborators] = useState<EntityId[]>(initialValues.collaborators);
  const [homeId, setHomeId] = useState<EntityId | "">(initialValues.home_id ?? "");

  useEffect(() => {
    if (!open) return;
    setName(initialValues.name);
    setCollaborators(initialValues.collaborators);
    setHomeId(initialValues.home_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), collaborators, home_id: homeId || null });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{mode === "add" ? "Create New List" : "Edit list"}</DialogTitle>
      <DialogContent>
        {mode === "add" && (
          <DialogContentText>Please enter the name of the new list you want to create.</DialogContentText>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="List Name"
          type="text"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>Collaborators</InputLabel>
          <Select
            multiple
            value={collaborators}
            onChange={(e) => setCollaborators(e.target.value as EntityId[])}
            renderValue={(selected) =>
              (selected as EntityId[])
                .map((id) => allCollaborators.find((user) => user.id === id)?.username || "")
                .join(", ")
            }
          >
            {allCollaborators.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.username}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {assignableHomes.length > 0 && (
          <FormControl fullWidth margin="dense">
            <InputLabel>Home</InputLabel>
            <Select value={homeId} label="Home" onChange={(e) => setHomeId(e.target.value)}>
              <MenuItem value="">None</MenuItem>
              {assignableHomes.map((home) => (
                <MenuItem key={home.id} value={home.id}>
                  {home.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ListFormDialog;
