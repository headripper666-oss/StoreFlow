import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import type { Recipe } from "../../types";
import { DEFAULT_TAGS } from "../../utils/recipeUtils";

interface TagsManagerProps {
  recipes: Recipe[];
  isSaving: boolean;
  onRenameTag: (oldTag: string, newTag: string) => Promise<void>;
  onDeleteTag: (tag: string) => Promise<void>;
}

export function TagsManager({ recipes, isSaving, onRenameTag, onDeleteTag }: TagsManagerProps) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const allTags: string[] = [
    ...new Set([
      ...DEFAULT_TAGS,
      ...recipes.flatMap((r) => r.tags ?? []),
    ]),
  ].sort();

  const countByTag = (tag: string) =>
    recipes.filter((r) => (r.tags ?? []).includes(tag)).length;

  const handleStartEdit = (tag: string) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  const handleConfirmRename = async () => {
    if (!editingTag) return;
    await onRenameTag(editingTag, editValue);
    setEditingTag(null);
  };

  const handleCancelEdit = () => setEditingTag(null);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {allTags.length} tag{allTags.length > 1 ? "s" : ""} — renommer ou supprimer un tag l'applique à toutes les recettes associées.
      </Typography>

      {allTags.map((tag, idx) => {
        const count = countByTag(tag);
        const isDefault = (DEFAULT_TAGS as readonly string[]).includes(tag);
        const isEditing = editingTag === tag;

        return (
          <Box key={tag}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                py: 1,
                px: 1,
                gap: 1,
                opacity: count === 0 ? 0.45 : 1,
              }}
            >
              {isEditing ? (
                <TextField
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmRename();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  autoFocus
                  size="small"
                  sx={{ flex: 1 }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={handleConfirmRename} disabled={!editValue.trim()}>
                            <CheckIcon fontSize="small" color="primary" />
                          </IconButton>
                          <IconButton size="small" onClick={handleCancelEdit}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              ) : (
                <>
                  <Typography variant="body1" sx={{ flex: 1, fontWeight: 500 }}>
                    {tag}
                  </Typography>
                  <Chip
                    label={count === 0 ? "0 recette" : `${count} recette${count > 1 ? "s" : ""}`}
                    size="small"
                    color={count > 0 ? "primary" : "default"}
                    variant="outlined"
                    sx={{ mr: 0.5 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleStartEdit(tag)}
                    disabled={isSaving}
                    sx={{ color: "text.secondary" }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setDeleteTarget(tag)}
                    disabled={isSaving || (isDefault && count === 0)}
                    sx={{ color: "text.disabled" }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
            {idx < allTags.length - 1 && <Divider />}
          </Box>
        );
      })}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Supprimer le tag "${deleteTarget}" ?`}
        message={
          deleteTarget
            ? `Ce tag sera retiré de ${countByTag(deleteTarget)} recette${countByTag(deleteTarget) > 1 ? "s" : ""}.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (deleteTarget) await onDeleteTag(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
