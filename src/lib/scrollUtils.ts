export function scrollToBottom(
  element: HTMLElement | null,
  options?: {
    behavior?: ScrollBehavior;
    retryDelays?: number[];
  },
): void {
  if (!element) return;

  const behavior = options?.behavior || "smooth";
  const retryDelays = options?.retryDelays || [50, 150, 300];

  // Find scrollable parent and scroll it to absolute bottom
  let currentElement: HTMLElement | null = element;
  let scrollableParent: HTMLElement | null = null;

  while (currentElement && currentElement !== document.body) {
    const style = window.getComputedStyle(currentElement);
    const hasOverflow =
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      style.overflow === "auto" ||
      style.overflow === "scroll";
    const isScrollable =
      currentElement.scrollHeight > currentElement.clientHeight;

    if (hasOverflow && isScrollable) {
      scrollableParent = currentElement;
      break;
    }
    currentElement = currentElement.parentElement;
  }

  if (
    !scrollableParent &&
    document.documentElement.scrollHeight > window.innerHeight
  ) {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior,
    });
    return;
  }

  if (scrollableParent) {
    scrollableParent.scrollTop = scrollableParent.scrollHeight;

    requestAnimationFrame(() => {
      scrollableParent!.scrollTo({
        top: scrollableParent!.scrollHeight,
        behavior,
      });
    });

    retryDelays.forEach((delay) => {
      setTimeout(() => {
        if (scrollableParent) {
          scrollableParent.scrollTop = scrollableParent.scrollHeight;
        }
      }, delay);
    });
  } else {
    element.scrollIntoView({
      behavior,
      block: "end",
      inline: "nearest",
    });
  }
}
