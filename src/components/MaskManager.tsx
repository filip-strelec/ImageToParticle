"use client";

import { useState } from "react";
import { OptionalMask } from "@/types";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

interface MaskManagerProps {
  masks: OptionalMask[];
  activeMaskId: string | null;
  onMasksChange: (masks: OptionalMask[]) => void;
  onActiveMaskChange: (maskId: string | null) => void;
}

// Generate a unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "mask";
}

// Predefined colors for masks (avoiding indigo which is used for interaction mask)
const MASK_COLORS = [
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

export default function MaskManager({
  masks,
  activeMaskId,
  onMasksChange,
  onActiveMaskChange,
}: MaskManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const addMask = () => {
    const newIndex = masks.length + 1;
    const newMask: OptionalMask = {
      id: generateId(),
      slug: `mask-${newIndex}`,
      name: `Mask ${newIndex}`,
      color: MASK_COLORS[masks.length % MASK_COLORS.length],
      data: null,
    };
    onMasksChange([...masks, newMask]);
    onActiveMaskChange(newMask.id);
  };

  const removeMask = (id: string) => {
    const newMasks = masks.filter(m => m.id !== id);
    onMasksChange(newMasks);
    if (activeMaskId === id) {
      onActiveMaskChange(newMasks.length > 0 ? newMasks[0].id : null);
    }
  };

  const startEditing = (mask: OptionalMask) => {
    setEditingId(mask.id);
    setEditName(mask.name);
  };

  const saveEdit = (id: string) => {
    const newMasks = masks.map(m => 
      m.id === id 
        ? { ...m, name: editName, slug: slugify(editName) }
        : m
    );
    onMasksChange(newMasks);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-400">Optional Masks</span>
          <p className="text-xs text-gray-500 mt-0.5">
            Group particles for custom behavior in exported code
          </p>
        </div>
        <button
          onClick={addMask}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs text-white transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Mask
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
        {masks.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No optional masks. Add one to group particles.
          </p>
        ) : (
          masks.map(mask => (
            <div
              key={mask.id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                activeMaskId === mask.id 
                  ? "bg-gray-700 ring-1 ring-indigo-500" 
                  : "bg-gray-800 hover:bg-gray-750"
              }`}
              onClick={() => onActiveMaskChange(mask.id)}
            >
              {/* Color indicator */}
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: mask.color }}
              />

              {/* Name/Slug editing */}
              {editingId === mask.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(mask.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); saveEdit(mask.id); }}
                    className="p-1 text-green-500 hover:text-green-400"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                    className="p-1 text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{mask.name}</div>
                    <div className="text-xs text-gray-500 truncate">slug: {mask.slug}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(mask); }}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMask(mask.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

