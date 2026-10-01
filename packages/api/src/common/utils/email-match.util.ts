import { Raw } from 'typeorm';

/**
 * Case-insensitive EXACT email comparison for TypeORM `where` clauses.
 *
 * Use this instead of `ILike(email)`. ILIKE treats `%` and `_` as wildcards,
 * and both are legal characters in an email's local part (class-validator's
 * @IsEmail accepts `%@gmail.com`). So `ILike('%@gmail.com')` matched every
 * Gmail account, and a lookup built on it returned the first one — which let
 * anyone with their own mailbox at a domain request a login or reset code for
 * themselves, then submit `%@thatdomain.com` and be signed in as (or reset the
 * password of) whichever older account at that domain the database returned
 * first. An underscore (`john_doe@x.com`) also matched `johnXdoe@x.com`.
 *
 * Here the address is a bound parameter compared with `=`, so wildcard
 * characters are just characters.
 */
export const emailMatches = (email: string) =>
  Raw((column) => `LOWER(${column}) = :emailLower`, { emailLower: email.trim().toLowerCase() });

/** Escapes `\`, `%` and `_` so user text can be used inside a LIKE/ILIKE pattern as plain characters. */
export const escapeLikePattern = (text: string) => text.replace(/[\\%_]/g, '\\$&');
