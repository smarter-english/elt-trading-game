// src/utils.js
export const normName = (s) =>
  (s || '')
    .toString()
    .normalize('NFKD') // split accents
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]/gi, '') // drop non-alphanumerics (incl spaces, dashes)
    .toLowerCase();
