const LIGHT_FAVICON_HREF = "/favicon-light.svg?v=4";
const DARK_FAVICON_HREF = "/favicon-dark.svg?v=4";

const getFaviconLink = () => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }

  return link;
};

export const syncFaviconWithColorScheme = () => {
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const updateFavicon = () => {
    getFaviconLink().href = colorSchemeQuery.matches ? DARK_FAVICON_HREF : LIGHT_FAVICON_HREF;
  };

  updateFavicon();
  colorSchemeQuery.addEventListener("change", updateFavicon);
};
