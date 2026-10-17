/**
 * Slug de perfil, gerado do nome na criação (copiado do Smart Desk).
 *
 * O `slug` é `immutable` no model: renomear um perfil não pode quebrar referência. Duas grafias
 * que colapsam no mesmo slug batem no índice `unique` e viram 409.
 */

/** Máximo do campo `slug` no model. */
const MAX_LENGTH = 60

export function slugifyRoleName(nome: string): string {
    return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, MAX_LENGTH)
        .replace(/-+$/g, "")
}
