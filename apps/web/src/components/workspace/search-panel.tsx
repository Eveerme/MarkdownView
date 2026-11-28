import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import {
  CaseSensitiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  RegexIcon,
  ReplaceIcon,
  SearchIcon,
  WholeWordIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { z } from "zod";

interface SearchPanelProps {
  focusSignal: number;
  onClose: () => void;
  open: boolean;
  replaceOpen: boolean;
  view: EditorView | null;
}

interface Match {
  from: number;
  to: number;
}

interface SearchPanelPlacement {
  left: number;
  top: number;
}

const storageKey = "markdownview:search-panel";

const storedPanelSchema = z.object({
  left: z.number().optional(),
  opacity: z.number().min(0.55).max(1).default(1),
  top: z.number().optional(),
});

const readStoredPanel = () => {
  try {
    const raw = localStorage.getItem(storageKey);

    if (raw === null) {
      return { opacity: 1, placement: null };
    }

    const parsed = storedPanelSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      return { opacity: 1, placement: null };
    }

    const { left, opacity, top } = parsed.data;

    const placement =
      left === undefined || top === undefined ? null : { left, top };

    return { opacity, placement };
  } catch {
    return { opacity: 1, placement: null };
  }
};

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const FlagButton = ({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    aria-label={label}
    aria-pressed={active}
    className={`search-flag ${active ? "search-flag-active" : ""}`}
    onClick={onClick}
    title={label}
    type="button"
  >
    {children}
  </button>
);

const collectMatches = (view: EditorView, query: SearchQuery) => {
  const matches: Match[] = [];

  try {
    const cursor = query.getCursor(view.state);

    for (let step = cursor.next(); step.done !== true; step = cursor.next()) {
      matches.push(step.value);
    }
  } catch {
    // An invalid regular expression has no matches.
  }

  return matches;
};

export const SearchPanel = ({
  focusSignal,
  onClose,
  open,
  replaceOpen,
  view,
}: SearchPanelProps) => {
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const [panelPosition, setPanelPosition] =
    useState<SearchPanelPlacement | null>(() => readStoredPanel().placement);

  const positionRef = useRef(panelPosition);
  const [opacity, setOpacity] = useState(() => readStoredPanel().opacity);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [, setRevision] = useState(0);

  const query = useMemo(
    () =>
      new SearchQuery({
        caseSensitive,
        regexp,
        replace,
        search,
        wholeWord,
      }),
    [caseSensitive, regexp, replace, search, wholeWord]
  );

  let matches: Match[] = [];

  if (open && view !== null && search !== "") {
    matches = collectMatches(view, query);
  }

  const cursorPosition = view?.state.selection.main.from ?? 0;

  const index = matches.findIndex(
    (match) => match.from <= cursorPosition && cursorPosition <= match.to
  );

  const activeIndex = matches.length === 0 ? 0 : Math.max(index, 0);

  const count =
    search === "" ? "0 / 0" : `${activeIndex + 1} / ${matches.length}`;

  const panelStyle: CustomProperties = {
    "--search-left":
      panelPosition === null ? "auto" : `${panelPosition.left}px`,
    "--search-opacity": String(opacity),
    "--search-right": panelPosition === null ? "10px" : "auto",
    "--search-top": panelPosition === null ? "10px" : `${panelPosition.top}px`,
  };

  useEffect(() => {
    if (!open || view === null) {
      return () => {
        // Nothing to release while the panel is closed.
      };
    }

    if (focusSignal >= 0) {
      input.current?.focus();
      input.current?.select();
    }

    return () => {
      // The panel keeps the search text between openings.
    };
  }, [focusSignal, open, view]);

  useEffect(() => {
    if (!open || view === null) {
      return () => {
        // Nothing to release while the panel is closed.
      };
    }

    view.dispatch({ effects: setSearchQuery.of(query) });

    return () => {
      // The query itself is only cleared when the panel closes.
    };
  }, [open, query, view]);

  useEffect(() => {
    if (!open || view === null) {
      return () => {
        // Nothing to listen to while the panel is closed.
      };
    }

    const bump = () => {
      setRevision((value) => value + 1);
    };

    view.dom.addEventListener("keyup", bump);
    view.dom.addEventListener("mouseup", bump);

    return () => {
      view.dom.removeEventListener("keyup", bump);
      view.dom.removeEventListener("mouseup", bump);
    };
  }, [open, view]);

  if (!open) {
    return null;
  }

  const applyQuery = () => {
    if (view === null) {
      return false;
    }

    view.dispatch({ effects: setSearchQuery.of(query) });

    return true;
  };

  const go = (direction: "next" | "previous") => {
    if (!applyQuery() || view === null) {
      return;
    }

    if (direction === "next") {
      findNext(view);
    } else {
      findPrevious(view);
    }

    setRevision((value) => value + 1);
  };

  const replaceOne = () => {
    if (!applyQuery() || view === null) {
      return;
    }

    replaceNext(view);
    setRevision((value) => value + 1);
  };

  const replaceEvery = () => {
    if (!applyQuery() || view === null) {
      return;
    }

    replaceAll(view);
    setRevision((value) => value + 1);
  };

  const persistPanel = (
    nextPosition: SearchPanelPlacement | null,
    nextOpacity: number
  ) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        left: nextPosition?.left,
        opacity: nextOpacity,
        top: nextPosition?.top,
      })
    );
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("button") !== null
    ) {
      return;
    }

    const element = panel.current;
    const parent = element?.parentElement ?? null;

    if (element === null || parent === null) {
      return;
    }

    event.preventDefault();

    const bounds = element.getBoundingClientRect();
    drag.current = {
      dx: event.clientX - bounds.left,
      dy: event.clientY - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = drag.current;
    const element = panel.current;
    const parent = element?.parentElement ?? null;

    if (dragState === null || element === null || parent === null) {
      return;
    }

    const bounds = parent.getBoundingClientRect();

    const next = {
      left: clamp(
        event.clientX - bounds.left - dragState.dx,
        8,
        Math.max(8, bounds.width - element.offsetWidth - 8)
      ),
      top: clamp(
        event.clientY - bounds.top - dragState.dy,
        8,
        Math.max(8, bounds.height - element.offsetHeight - 8)
      ),
    };

    positionRef.current = next;
    setPanelPosition(next);
  };

  const endDrag = () => {
    if (drag.current === null) {
      return;
    }

    drag.current = null;
    setDragging(false);
    persistPanel(positionRef.current, opacity);
  };

  const resetPosition = () => {
    positionRef.current = null;
    setPanelPosition(null);
    persistPanel(null, opacity);
  };

  const close = () => {
    if (view !== null) {
      view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: "" })),
      });
      view.focus();
    }

    onClose();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      go(event.shiftKey ? "previous" : "next");
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const onReplaceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      replaceOne();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <dialog
      aria-label="查找与替换"
      className={`search-panel ${dragging ? "search-panel-dragging" : ""}`}
      open
      ref={panel}
      style={panelStyle}
    >
      <div
        className="search-panel-head"
        onDoubleClick={resetPosition}
        onPointerCancel={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        title="拖动移动，双击复位"
      >
        <span className="search-panel-grip">
          <GripVerticalIcon />
        </span>
        <div className="search-panel-title">
          <SearchIcon />
          查找与替换
          <span className="search-panel-count">{count}</span>
        </div>
        <div className="search-panel-tools">
          <FlagButton
            active={caseSensitive}
            label="区分大小写"
            onClick={() => {
              setCaseSensitive((value) => !value);
            }}
          >
            <CaseSensitiveIcon />
          </FlagButton>
          <FlagButton
            active={regexp}
            label="正则表达式"
            onClick={() => {
              setRegexp((value) => !value);
            }}
          >
            <RegexIcon />
          </FlagButton>
          <FlagButton
            active={wholeWord}
            label="全词匹配"
            onClick={() => {
              setWholeWord((value) => !value);
            }}
          >
            <WholeWordIcon />
          </FlagButton>
          <button
            aria-label="关闭"
            className="search-panel-close"
            onClick={close}
            type="button"
          >
            <XIcon />
          </button>
        </div>
      </div>

      <div className="search-panel-row">
        <label className="search-field">
          <SearchIcon />
          <input
            aria-label="查找"
            onChange={(event) => {
              setSearch(event.currentTarget.value);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="查找…"
            ref={input}
            value={search}
          />
        </label>
        <button
          aria-label="上一个"
          className="search-step"
          onClick={() => {
            go("previous");
          }}
          title="上一个 (Shift+Enter)"
          type="button"
        >
          <ChevronUpIcon />
        </button>
        <button
          aria-label="下一个"
          className="search-step"
          onClick={() => {
            go("next");
          }}
          title="下一个 (Enter)"
          type="button"
        >
          <ChevronDownIcon />
        </button>
      </div>

      {replaceOpen ? (
        <div className="search-panel-row search-panel-replace">
          <label className="search-field">
            <ReplaceIcon />
            <input
              aria-label="替换为"
              onChange={(event) => {
                setReplace(event.currentTarget.value);
              }}
              onKeyDown={onReplaceKeyDown}
              placeholder="替换为…"
              value={replace}
            />
          </label>
          <button className="search-action" onClick={replaceOne} type="button">
            替换
          </button>
          <button
            className="search-action search-action-primary"
            onClick={replaceEvery}
            type="button"
          >
            全部替换
          </button>
        </div>
      ) : null}

      <div className="search-panel-foot">
        <span className="search-kbd">Enter</span>
        <span>下一个</span>
        <span className="search-kbd">Shift+Enter</span>
        <span>上一个</span>
        <span className="search-panel-spacer" />
        <label className="search-opacity">
          透明度
          <input
            aria-label="透明度"
            max={100}
            min={55}
            onChange={(event) => {
              const next = Number(event.currentTarget.value) / 100;
              setOpacity(next);
              persistPanel(positionRef.current, next);
            }}
            step={1}
            type="range"
            value={Math.round(opacity * 100)}
          />
          <b>{Math.round(opacity * 100)}%</b>
        </label>
      </div>
      <div className="search-panel-hint">
        <b>拖动标题栏移动</b>
        <span>·</span>
        <b>双击复位</b>
        <span>·</span>
        <span>位置和透明度会记住</span>
      </div>
    </dialog>
  );
};
