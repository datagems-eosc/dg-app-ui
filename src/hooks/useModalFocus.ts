"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Keyboard focus for one modal dialog layer.
 *
 * While `active`, the layer is pushed onto a stack shared by every dialog using
 * this hook. Only the **top** layer answers the keyboard, so a confirmation
 * opened over a dialog owns Tab and Escape, and one Escape closes only it:
 *
 *  - on activation, focus moves into the container (see `initialFocus`) and
 *    the element that had focus is remembered as the launcher;
 *  - Tab and Shift+Tab wrap inside the container, and focus that lands behind
 *    it by any other route is brought back;
 *  - on deactivation, focus returns to the launcher when it can still take it.
 *    When it cannot — removed, or now disabled — focus goes to the dialog
 *    underneath, whose container must therefore accept programmatic focus
 *    (`tabIndex={-1}`). With no dialog underneath it is left to the document.
 *    Nothing moves if focus has meanwhile gone somewhere else on purpose;
 *  - body scrolling is locked by the first layer and restored by the last, so
 *    closing a nested confirmation does not unlock the page behind its parent.
 *
 * Opt-in. Dialogs with their own listeners keep them; mixing both kinds in one
 * stack is not supported.
 */
export interface ModalFocusOptions {
  readonly active: boolean;
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Called on Escape while this layer is on top. Omit to ignore Escape. */
  readonly onEscape?: () => void;
  /**
   * Where focus starts. Defaults to the first tabbable element, or the
   * container itself when it has none.
   */
  readonly initialFocus?: "first-tabbable" | "container";
}

interface Layer {
  readonly container: HTMLElement | null;
  launcher: HTMLElement | null;
}

const layers: Layer[] = [];
let lockedOverflow: string | null = null;

const TABBABLE = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[tabindex]",
  "[contenteditable='true']",
].join(",");

/** In DOM order; layout is not consulted, so this behaves the same in jsdom. */
export const tabbableWithin = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      element.closest("[hidden], [inert]") === null,
  );

const canTakeFocus = (element: HTMLElement | null): element is HTMLElement =>
  element !== null &&
  element !== document.body &&
  element.isConnected &&
  !element.matches(":disabled") &&
  element.closest("[inert]") === null;

export function useModalFocus({
  active,
  containerRef,
  onEscape,
  initialFocus = "first-tabbable",
}: ModalFocusOptions): void {
  // Latest options without re-running the layer effect: a caller's inline
  // `onClose` must not tear the layer down and refocus on every render.
  const onEscapeRef = useRef(onEscape);
  const initialFocusRef = useRef(initialFocus);
  useEffect(() => {
    onEscapeRef.current = onEscape;
    initialFocusRef.current = initialFocus;
  });

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    const previous = document.activeElement;
    const layer: Layer = {
      container,
      launcher:
        previous instanceof HTMLElement && previous !== document.body
          ? previous
          : null,
    };
    if (layers.length === 0) {
      lockedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    layers.push(layer);

    const isTop = () => layers[layers.length - 1] === layer;
    const current = () => containerRef.current ?? container;

    if (container !== null && !container.contains(document.activeElement)) {
      const first =
        initialFocusRef.current === "first-tabbable"
          ? tabbableWithin(container)[0]
          : undefined;
      (first ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === "Escape") {
        const handler = onEscapeRef.current;
        if (handler !== undefined) {
          event.preventDefault();
          handler();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const element = current();
      if (element === null) return;
      const tabbable = tabbableWithin(element);
      const first = tabbable[0];
      const last = tabbable[tabbable.length - 1];
      const focused = document.activeElement;
      const outside =
        focused === element ||
        !(focused instanceof Node) ||
        !element.contains(focused);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        element.focus();
      } else if (event.shiftKey && (outside || focused === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || focused === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTop()) return;
      const element = current();
      if (
        element === null ||
        !(event.target instanceof Node) ||
        element.contains(event.target)
      ) {
        return;
      }
      (tabbableWithin(element)[0] ?? element).focus();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);

      const index = layers.indexOf(layer);
      if (index === -1) return;
      const wasTop = index === layers.length - 1;
      layers.splice(index, 1);
      if (layers.length === 0) {
        document.body.style.overflow = lockedOverflow ?? "";
        lockedOverflow = null;
      }

      if (!wasTop) {
        // A dialog closed underneath the one above it: that one now returns
        // focus to wherever this one would have.
        const above = layers[index];
        if (
          above !== undefined &&
          (above.launcher === null ||
            container?.contains(above.launcher) === true)
        ) {
          above.launcher = layer.launcher;
        }
        return;
      }

      const focused = document.activeElement;
      const focusLost =
        focused === null ||
        focused === document.body ||
        container?.contains(focused) === true;
      if (!focusLost) return;

      const below = layers[layers.length - 1]?.container ?? null;
      const launcher = layer.launcher;
      if (
        canTakeFocus(launcher) &&
        (below === null || below.contains(launcher))
      ) {
        launcher.focus();
      } else if (below?.isConnected) {
        below.focus();
      }
    };
  }, [active, containerRef]);
}
