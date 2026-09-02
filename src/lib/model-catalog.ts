import { MODEL_REGISTRY } from "@/lib/models/registry";

export const MODEL_CATALOG = MODEL_REGISTRY.map((m) => ({
  id: m.id,
  label: m.label,
  category: m.category,
}));
