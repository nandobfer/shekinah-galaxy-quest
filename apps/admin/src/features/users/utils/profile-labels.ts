import type { UnassignableReason } from "@nandobfer/perfix"

/** Motivos de perfil não concedível com o vocabulário da interface do CRM ("perfil"). */
export const UNASSIGNABLE_PROFILE_LABELS: Record<UnassignableReason, string> = {
    hierarquia: "Este perfil está acima do seu — você não pode concedê-lo",
    "chave-sensivel": "Este perfil concede permissões sensíveis que você não possui",
}
