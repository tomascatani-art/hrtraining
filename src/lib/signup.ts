/** Alta libre de cuentas nuevas (crea otra organización). Cerrada salvo que ALLOW_SIGNUP=1. */
export const signupOpen = () => process.env.ALLOW_SIGNUP === "1";
