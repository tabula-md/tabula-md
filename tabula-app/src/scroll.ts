export const getScrollRatio = (element: HTMLElement) => {
  const maxScrollTop = element.scrollHeight - element.clientHeight;
  return maxScrollTop <= 0 ? 0 : element.scrollTop / maxScrollTop;
};

export const scrollElementToRatio = (element: HTMLElement, ratio: number) => {
  const maxScrollTop = element.scrollHeight - element.clientHeight;
  element.scrollTop = Math.max(0, Math.min(1, ratio)) * Math.max(0, maxScrollTop);
};
