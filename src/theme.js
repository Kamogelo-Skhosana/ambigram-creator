import { ThemeEngine } from '@themeloom/core'
import { retroY2k } from '@themeloom/themes-classic'

/**
 * The app runs on one themeloom theme rather than a hand-rolled palette.
 *
 * A theme is a whole design contract — colour, type, shape and motion — so
 * style.css maps its own variables onto the `--pt-*` custom properties the
 * engine writes, and every rule downstream follows. Swapping to a different
 * theme from the pack is a one-line change here.
 *
 * `persist: false` because there is nothing to remember: the app ships one
 * theme, not a picker.
 */
export const theme = retroY2k

export const engine = new ThemeEngine({
  themes: [theme],
  default: theme.id,
  persist: false,
})

/**
 * Artwork colours for the ambigram itself.
 *
 * These are the defaults the ink/paper pickers start on, and what "Reset" goes
 * back to. They come from the theme so the drawing sits in the same world as
 * the interface around it — but they stay user-editable, since the whole point
 * of the app is choosing your own ink.
 */
export const artworkDefaults = {
  ink: theme.color.text,
  paper: theme.color.cardBg,
}
