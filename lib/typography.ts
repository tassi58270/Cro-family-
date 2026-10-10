/**
 * French typography for texts typed by the family, applied when they are
 * shown: narrow no-break space before ; : ! ?, no-break spaces inside « »,
 * typographic apostrophe. Times like 10:30 and web addresses are left alone.
 */
export function frenchTypography(text: string): string {
  return text
    .replace(/(\S)'(?=\p{L})/gu, "$1’")
    .replace(/[  ]+([;:!?])(?=\s|$)/g, " $1")
    .replace(/(\p{L}|[»)\]])([;!?])(?=\s|$)/gu, "$1 $2")
    .replace(/«[   ]*/g, "« ")
    .replace(/[   ]*»/g, " »");
}

/** Applies the rules of the text's language (only French has any for now). */
export function typeset(text: string, lang: string): string {
  return lang === "fr" ? frenchTypography(text) : text;
}
