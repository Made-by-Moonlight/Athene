/**
 * Per-project identity color. Maps a project's REGISTRATION INDEX (its position
 * in the ordered list of registered project IDs — i.e. insertion order in the
 * global config) to one of 8 palette slots, cycling after 8.
 *
 * The color is an identity axis only, kept separate from semantic status color
 * and always paired with the project name/dot (never the sole signal).
 */
export interface ProjectColor {
  /** Palette slot 1..8. */
  slot: number;
  /** CSS var for the project color, e.g. "var(--project-color-3)". */
  colorVar: string;
  /** CSS var for the companion tint, e.g. "var(--project-tint-3)". */
  tintVar: string;
}

export const PROJECT_COLOR_SLOTS = 8;

export function getProjectColor(
  projectId: string,
  registeredProjectIds: string[],
): ProjectColor {
  const index = registeredProjectIds.indexOf(projectId);
  const slot = ((index < 0 ? 0 : index) % PROJECT_COLOR_SLOTS) + 1;
  return {
    slot,
    colorVar: `var(--project-color-${slot})`,
    tintVar: `var(--project-tint-${slot})`,
  };
}
