export const isTabulaPlusEnabled = () => {
  const configuredValue = import.meta.env.VITE_TABULA_PLUS_ENABLED as string | undefined;
  return configuredValue === "1" || configuredValue === "true";
};
