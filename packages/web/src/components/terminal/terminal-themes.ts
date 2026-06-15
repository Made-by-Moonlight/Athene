import type { ITheme } from "@xterm/xterm";

export type TerminalVariant = "agent" | "orchestrator";

export function buildTerminalThemes(_variant: TerminalVariant): {
  dark: ITheme;
  light: ITheme;
  aurora: ITheme;
} {
  // Mission-control terminal theme — the frame & xterm theme are ours; the PTY
  // content is the agent's own ANSI. The 16-color palette is harmonized to the
  // design tokens (xterm needs concrete hex, so these mirror globals.css). The
  // cursor is the "an agent is alive" signal — and selection matches the accent.
  const dark: ITheme = {
    background: "#0c0d10", // --term
    foreground: "#c5ccd3",
    cursor: "#f59f4c",         // --orange: working-agent signal
    cursorAccent: "#0c0d10",
    selectionBackground: "rgba(77, 141, 255, 0.30)",   // --blue selection
    selectionInactiveBackground: "rgba(128, 128, 128, 0.2)",
    // ANSI palette tied to mission-control tokens
    black: "#15171b", // --card
    red: "#ef6b6b",   // --red
    green: "#74b98a", // --green
    yellow: "#e8c14a", // --amber
    blue: "#4d8dff",  // --blue
    magenta: "#a78bfa",
    cyan: "#6fb3c9",
    white: "#c5ccd3",
    brightBlack: "#444951", // --t4
    brightRed: "#ff8a8a",
    brightGreen: "#8fd6a6",
    brightYellow: "#f0d06b",
    brightBlue: "#7eaaff", // --blue-soft
    brightMagenta: "#c4b0fc",
    brightCyan: "#8fcfe0",
    brightWhite: "#f4f5f7", // --t1
  };

  // Aurora terminal — violet-tinted dark background, coral cursor, teal selection
  const aurora: ITheme = {
    background: "#0e0c13", // --term (aurora)
    foreground: "#c5cad6",
    cursor: "#f2736b",         // --coral: working-agent signal
    cursorAccent: "#0e0c13",
    selectionBackground: "rgba(56, 196, 216, 0.30)",   // --teal selection
    selectionInactiveBackground: "rgba(128, 128, 128, 0.2)",
    // ANSI palette harmonized to aurora tokens
    black: "#18151f", // --card (aurora)
    red: "#ef6b6b",   // --red
    green: "#6abf8a", // --green (aurora)
    yellow: "#e8c14a", // --amber
    blue: "#38c4d8",  // --teal
    magenta: "#a78bfa",
    cyan: "#72d9e7",  // --teal-soft
    white: "#c5cad6",
    brightBlack: "#3c3e54", // --t4 (aurora)
    brightRed: "#ff8a8a",
    brightGreen: "#8fd6a6",
    brightYellow: "#f0d06b",
    brightBlue: "#72d9e7", // --teal-soft
    brightMagenta: "#c4b0fc",
    brightCyan: "#94e4ef",
    brightWhite: "#f0f1f5", // --t1 (aurora)
  };

  const light: ITheme = {
    background: "#fafafa",
    foreground: "#24292f",
    cursor: "#f59f4c",
    cursorAccent: "#fafafa",
    selectionBackground: "rgba(77, 141, 255, 0.25)",
    selectionInactiveBackground: "rgba(128, 128, 128, 0.15)",
    // ANSI colors — darkened for legibility on #fafafa terminal background
    black: "#24292f",
    red: "#b42318",
    green: "#1f7a3d",
    yellow: "#8a5a00",
    blue: "#175cd3",
    magenta: "#8e24aa",
    cyan: "#0b7285",
    white: "#4b5563",
    brightBlack: "#374151",
    brightRed: "#912018",
    brightGreen: "#176639",
    brightYellow: "#6f4a00",
    brightBlue: "#1d4ed8",
    brightMagenta: "#7b1fa2",
    brightCyan: "#155e75",
    brightWhite: "#374151",
  };

  return { dark, aurora, light };
}
