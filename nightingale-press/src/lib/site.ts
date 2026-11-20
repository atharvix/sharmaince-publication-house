/** The press's name, as written in its own company profile. */
export const SITE_NAME = 'Sharmiance Publication House & Distribution';
export const SITE_TAGLINE = 'Publishing ideas. Connecting readers.';

/**
 * Public contact details shown on the Contact page. Each one stays null until the press
 * confirms it, and the page only lists the ones that are filled in. Never put a
 * placeholder here: it would be published as if it were real.
 */
export const SITE_CONTACT: Record<'email' | 'phone' | 'office' | 'hours', string | null> = {
  email: null,
  phone: null,
  office: null,
  hours: null,
};
