import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type InlineConversionsPlugin from "./main";

const INLINE_CODE = /`([^`\n]+)`/g;

export function createLivePreviewExtension(plugin: InlineConversionsPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, plugin);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged || update.selectionSet || update.transactions.length > 0) {
          this.decorations = buildDecorations(update.view, plugin);
        }
      }
    },
    { decorations: (instance) => instance.decorations },
  );
}

function buildDecorations(view: EditorView, plugin: InlineConversionsPlugin): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to);
    INLINE_CODE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = INLINE_CODE.exec(text))) {
      const from = range.from + match.index;
      const to = from + match[0].length;
      if (selectionTouches(view, from, to)) continue;
      if (!plugin.evaluateToken(match[1])) continue;

      builder.add(
        from,
        to,
        Decoration.replace({
          widget: new InlineConversionsWidget(plugin, match[1], plugin.revision),
        }),
      );
    }
  }
  return builder.finish();
}

function selectionTouches(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

class InlineConversionsWidget extends WidgetType {
  constructor(
    private readonly plugin: InlineConversionsPlugin,
    private readonly token: string,
    private readonly revision: number,
  ) {
    super();
  }

  eq(other: InlineConversionsWidget): boolean {
    return other.token === this.token && other.revision === this.revision;
  }

  toDOM(): HTMLElement {
    return this.plugin.createValueElement(this.token);
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== "mousedown";
  }
}
