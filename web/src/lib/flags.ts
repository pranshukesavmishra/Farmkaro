/**
 * NEXT_PUBLIC_STATIC=1 marks a build with no server behind it (the GitHub
 * Pages demo). Transactional surfaces degrade to honest "pilot app" notices
 * instead of buttons that would fail.
 */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
